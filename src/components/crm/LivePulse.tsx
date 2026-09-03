'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { play } from '@/lib/sound';

export type Counts = {
  pendingReview: number;
  newLeads: number;
  dueFollowUps: number;
  overdueFollowUps: number;
  visitsToday: number;
  /** Owners reporting a property sold or rented, waiting on a call. */
  ownerRequests: number;
  latest: { title: string; at: string } | null;
  nextVisit: { id: string; at: string; title: string; who: string | null } | null;
};

type Toast = { text: string; href: string; tone: 'alert' | 'info' };

/**
 * Keeps the CRM current and speaks up when something needs a person.
 *
 * Push first: an event-stream connection means a submission reaches this tab the
 * moment it lands. A slow poll runs alongside as a safety net, and doubles as the
 * source of the counts shown on the nav.
 *
 * Reminders — an imminent site visit, follow-ups slipping overdue — are announced
 * once each, tracked in a set, so a tab left open all day does not nag.
 */
export default function LivePulse({ onCounts }: { onCounts?: (counts: Counts) => void }) {
  const router = useRouter();
  const previous = useRef<Counts | null>(null);
  const announced = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [live, setLive] = useState(false);

  const push = useCallback((toast: Toast, sound: 'submission' | 'lead' | null = 'submission') => {
    setToasts((current) => [...current.filter((t) => t.text !== toast.text), toast].slice(-3));
    if (sound) play(sound);
    setTimeout(() => setToasts((current) => current.filter((t) => t.text !== toast.text)), 14000);
  }, []);

  const check = useCallback(
    async (announce = true) => {
      if (document.visibilityState === 'hidden') return;
      try {
        const response = await fetch('/api/crm/pulse', { cache: 'no-store' });

        /*
         * The session has gone — deactivated, removed from the team, role changed,
         * or signed out elsewhere. Every one of those bumps sessionEpoch server
         * side, so the very next request is rejected.
         *
         * This poll is the only thing that notices promptly. Without it a removed
         * person's open tab keeps showing the desk until they happen to navigate,
         * which is exactly the wrong moment to be relaxed about: revoking access
         * should mean the screen clears, not that it clears eventually.
         *
         * Replace rather than push, so Back cannot return them to a cached page.
         */
        if (response.status === 401 || response.status === 403) {
          window.location.replace('/login?ended=1');
          return;
        }

        if (!response.ok) return;
        const { data } = (await response.json()) as { data: Counts };

        const before = previous.current;
        previous.current = data;
        onCounts?.(data);

        // A visit inside the hour, announced once.
        if (data.nextVisit && !announced.current.has(`visit-${data.nextVisit.id}`)) {
          announced.current.add(`visit-${data.nextVisit.id}`);
          const at = new Date(data.nextVisit.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
          push(
            {
              text: `Site visit at ${at} — ${data.nextVisit.who ?? data.nextVisit.title}`,
              href: '/crm/site-visits',
              tone: 'info',
            },
            'lead',
          );
        }

        if (!before) return;

        if (announce && data.pendingReview > before.pendingReview) {
          push({
            text: data.latest?.title ? `New submission: ${data.latest.title}` : 'A new property has been submitted',
            href: '/crm/review',
            tone: 'alert',
          });
        }
        /*
         * An owner reporting a property sold or rented out.
         *
         * Uses the 'submission' sound rather than 'lead' — it is the one meant to
         * be noticed, and this carries the same weight as a new listing arriving:
         * a live listing stays on the website until someone rings the owner back,
         * so a missed one is a property advertised that is no longer for sale.
         */
        if (announce && data.ownerRequests > before.ownerRequests) {
          const many = data.ownerRequests - before.ownerRequests > 1;
          push({
            text: many
              ? `${data.ownerRequests} owners have reported a property sold or rented`
              : 'An owner has reported their property sold or rented out',
            href: '/crm/owner-requests',
            tone: 'alert',
          });
        }
        if (announce && data.newLeads > before.newLeads) {
          push({ text: 'A new lead has come in', href: '/crm/leads', tone: 'alert' }, 'lead');
        }
        if (announce && data.overdueFollowUps > before.overdueFollowUps) {
          push({ text: `${data.overdueFollowUps} follow-ups are overdue`, href: '/crm/follow-ups', tone: 'alert' }, 'lead');
        }

        const changed =
          before.pendingReview !== data.pendingReview ||
          before.newLeads !== data.newLeads ||
          before.dueFollowUps !== data.dueFollowUps ||
          before.overdueFollowUps !== data.overdueFollowUps ||
          before.visitsToday !== data.visitsToday ||
          before.ownerRequests !== data.ownerRequests;

        if (changed) router.refresh();
      } catch {
        /* the next attempt will do */
      }
    },
    [router, onCounts, push],
  );

  /**
   * Lets a page force an immediate re-count. Marking leads as viewed changes the
   * badge, and waiting for the next poll to notice would leave it lit for a few
   * seconds after the person is already looking at the list.
   */
  useEffect(() => {
    const handler = () => check(false);
    window.addEventListener('crm:recount', handler);
    return () => window.removeEventListener('crm:recount', handler);
  }, [check]);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let opening: ReturnType<typeof setTimeout> | null = null;

    // Deferred past the load event, so the tab's loading indicator can finish.
    function connect() {
      source = new EventSource('/api/crm/stream');
      source.addEventListener('ready', () => setLive(true));
      source.addEventListener('change', (event) => {
        const payload = JSON.parse((event as MessageEvent).data || '{}');
        if (payload.kind === 'submission') {
          push({
            text: payload.title ? `New submission: ${payload.title}` : 'A new property has been submitted',
            href: '/crm/review',
            tone: 'alert',
          });
        } else if (payload.kind === 'lead') {
          push({ text: payload.title ? `New lead: ${payload.title}` : 'A new lead has come in', href: '/crm/leads', tone: 'alert' }, 'lead');
        }
        router.refresh();
        check(false);
      });
      source.onerror = () => {
        setLive(false);
        source?.close();
        retry = setTimeout(connect, 5000);
      };
    }

    function connectAfterLoad() {
      opening = setTimeout(connect, 1000);
    }

    if (document.readyState === 'complete') connectAfterLoad();
    else window.addEventListener('load', connectAfterLoad, { once: true });

    return () => {
      source?.close();
      if (retry) clearTimeout(retry);
      if (opening) clearTimeout(opening);
      window.removeEventListener('load', connectAfterLoad);
    };
  }, [router, push, check]);

  useEffect(() => {
    check(false);
    const timer = setInterval(() => check(true), live ? 45000 : 10000);
    const onVisible = () => document.visibilityState === 'visible' && check(false);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check, live]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[300] flex -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-6 sm:translate-x-0">
      {toasts.map((toast) => (
        <div
          key={toast.text}
          className={`animate-rise flex items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-2xl ${
            toast.tone === 'alert' ? 'border-[var(--danger)]' : 'border-[var(--brand)]'
          }`}
        >
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
              toast.tone === 'alert' ? 'bg-[#fdeaea]' : 'bg-[var(--brand-soft)]'
            }`}
          >
            {toast.tone === 'alert' ? '🔔' : '📅'}
          </span>
          <span>
            <span className="block text-sm font-semibold text-[var(--navy)]">{toast.text}</span>
            <Link href={toast.href} className="text-xs font-semibold text-[var(--brand)] hover:underline">
              Open →
            </Link>
          </span>
          <button
            type="button"
            className="ml-2 text-[var(--muted)] hover:text-[var(--ink)]"
            onClick={() => setToasts((current) => current.filter((t) => t.text !== toast.text))}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { openInstallDialog } from '@/components/PwaSetup';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import LivePulse, { type Counts } from './LivePulse';
import SoundToggle from '../SoundToggle';

export type CrmUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  permissions: string[];
};

const UserContext = createContext<CrmUser | null>(null);

export const useCrmUser = () => useContext(UserContext);
export function useCan() {
  const user = useContext(UserContext);
  return (permission: string) => !!user?.permissions.includes(permission);
}

/** Nav is derived from permissions, so nobody sees a link to a screen they cannot open. */
const NAV: { href: string; label: string; icon: string; needs?: string[]; group: string }[] = [
  { href: '/crm', label: 'Desk', icon: '🏠', group: 'Today' },
  { href: '/crm/follow-ups', label: 'Follow-ups', icon: '📞', group: 'Today', needs: ['lead.view', 'lead.view.all'] },
  { href: '/crm/site-visits', label: 'Site Visits', icon: '📅', group: 'Today', needs: ['visit.view', 'visit.view.all'] },

  { href: '/crm/review', label: 'Review Queue', icon: '📋', group: 'Inventory', needs: ['property.view', 'property.view.all'] },
  { href: '/crm/owner-requests', label: 'Owner Requests', icon: '📣', group: 'Inventory', needs: ['property.edit'] },
  { href: '/crm/properties', label: 'Properties', icon: '🏘️', group: 'Inventory', needs: ['property.view', 'property.view.all'] },
  { href: '/crm/listings', label: 'Listings', icon: '🏷️', group: 'Inventory', needs: ['property.view', 'property.view.all'] },
  { href: '/crm/hot-deals', label: 'Hot Deals', icon: '🔥', group: 'Inventory', needs: ['property.view', 'property.view.all'] },
  { href: '/crm/owners', label: 'Owners', icon: '👤', group: 'Inventory', needs: ['owner.view', 'owner.view.all'] },
  { href: '/crm/documents', label: 'Documents', icon: '📁', group: 'Inventory', needs: ['property.document.view'] },

  { href: '/crm/leads', label: 'Leads', icon: '🎯', group: 'Demand', needs: ['lead.view', 'lead.view.all'] },
  { href: '/crm/clients', label: 'Clients', icon: '👥', group: 'Demand', needs: ['client.view', 'client.view.all'] },
  { href: '/crm/requirements', label: 'Requirements', icon: '📝', group: 'Demand', needs: ['requirement.view', 'requirement.view.all'] },
  { href: '/crm/property-demand', label: 'Property Demand', icon: '🥇', group: 'Demand', needs: ['requirement.view', 'requirement.view.all'] },

  { href: '/crm/deals', label: 'Deals', icon: '🤝', group: 'Transaction', needs: ['deal.view', 'deal.view.all'] },

  { href: '/crm/consultants', label: 'Consultants', icon: '🧑‍💼', group: 'Network', needs: ['consultant.view'] },
  { href: '/crm/collaborations', label: 'Collaborations', icon: '🔗', group: 'Network', needs: ['collaboration.manage'] },

  { href: '/crm/reports', label: 'Reports', icon: '📊', group: 'System', needs: ['report.view'] },
  { href: '/crm/users', label: 'Team', icon: '🧑‍🤝‍🧑', group: 'System', needs: ['user.manage'] },
  { href: '/crm/settings', label: 'Settings', icon: '⚙️', group: 'System', needs: ['setting.manage'] },
  { href: '/crm/audit', label: 'Audit Log', icon: '🗒️', group: 'System', needs: ['audit.view'] },
];

const GROUPS = ['Today', 'Inventory', 'Demand', 'Transaction', 'Network', 'System'];

const ADD_NEW = [
  { href: '/crm/properties/new', label: 'Add Property', needs: 'property.create' },
  { href: '/crm/leads', label: 'Add Lead', needs: 'lead.create' },
  { href: '/crm/clients', label: 'Add Client', needs: 'client.create' },
  { href: '/crm/owners', label: 'Add Owner', needs: 'owner.create' },
  { href: '/crm/site-visits', label: 'Schedule Visit', needs: 'visit.create' },
];

type Hit = { type: string; id: string; code: string; title: string; subtitle?: string; href: string };

/** Global search. Ctrl+K focuses it; a public ID finds its listing directly. */
function GlobalSearch() {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === 'Escape') setOpen(false);
    }
    function onClick(event: MouseEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, []);

  useEffect(() => {
    if (term.trim().length < 2) {
      setHits([]);
      return;
    }
    setBusy(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term.trim())}`)
        .then((r) => r.json())
        .then((payload) => {
          setHits(payload.data ?? []);
          setOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(timer);
  }, [term]);

  return (
    <div ref={wrapper} className="relative min-w-[200px] flex-1 lg:max-w-xl">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">🔍</span>
      <input
        ref={input}
        className="field py-2.5 pl-10 pr-16"
        placeholder="Search code, property, client, lead…"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
      />
      <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border px-1.5 py-0.5 text-[11px] text-[var(--muted)] sm:block">
        Ctrl + K
      </kbd>

      {open && (
        <div className="absolute z-[200] mt-2 max-h-[420px] w-full overflow-y-auto rounded-xl border bg-white py-2 shadow-2xl">
          {busy && <p className="px-4 py-2 text-sm text-[var(--muted)]">Searching…</p>}
          {!busy && hits.length === 0 && <p className="px-4 py-3 text-sm text-[var(--muted)]">Nothing matches that.</p>}
          {hits.map((hit) => (
            <button
              key={`${hit.type}-${hit.id}`}
              type="button"
              onClick={() => {
                setOpen(false);
                setTerm('');
                router.push(hit.href);
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--paper)]"
            >
              <span className="badge shrink-0">{hit.type}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-[var(--navy)]">{hit.title}</span>
                <span className="mono block truncate text-xs text-[var(--muted)]">
                  {hit.code}
                  {hit.subtitle ? ` · ${hit.subtitle}` : ''}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CrmShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CrmUser | null>(null);
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const previousCounts = useRef<Counts | null>(null);
  const [flashing, setFlashing] = useState<Record<string, boolean>>({});

  /**
   * A count that has just gone up flashes for a few seconds, so a change noticed
   * out of the corner of the eye is still findable a moment later.
   */
  function onCounts(next: Counts) {
    const before = previousCounts.current;
    previousCounts.current = next;
    setCounts(next);
    if (!before) return;

    const risen: Record<string, boolean> = {};
    if (next.pendingReview > before.pendingReview) risen['/crm/review'] = true;
    if (next.newLeads > before.newLeads) risen['/crm/leads'] = true;
    if (next.dueFollowUps + next.overdueFollowUps > before.dueFollowUps + before.overdueFollowUps) risen['/crm/follow-ups'] = true;
    if (next.visitsToday > before.visitsToday) risen['/crm/site-visits'] = true;

    if (Object.keys(risen).length) {
      setFlashing(risen);
      setTimeout(() => setFlashing({}), 8000);
    }
  }

  /** How many items sit behind each nav entry, and how urgent they are. */
  function badgeFor(href: string): { count: number; tone: 'alert' | 'warn' | 'info' } | null {
    if (!counts) return null;
    if (href === '/crm/review' && counts.pendingReview > 0) return { count: counts.pendingReview, tone: 'alert' };
    if (href === '/crm/leads' && counts.newLeads > 0) return { count: counts.newLeads, tone: 'alert' };
    if (href === '/crm/follow-ups') {
      const total = counts.dueFollowUps + counts.overdueFollowUps;
      if (total > 0) return { count: total, tone: counts.overdueFollowUps > 0 ? 'alert' : 'warn' };
    }
    if (href === '/crm/site-visits' && counts.visitsToday > 0) return { count: counts.visitsToday, tone: 'info' };
    // Owners waiting on a call to confirm a sale — the same weight as a listing
    // waiting for review, because both are someone waiting on us.
    if (href === '/crm/owner-requests' && counts.ownerRequests > 0) {
      return { count: counts.ownerRequests, tone: 'alert' };
    }
    return null;
  }
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((payload) => setUser(payload.data))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setOpen(false);
    setAddOpen(false);
  }, [pathname]);

  const visible = NAV.filter((item) => !item.needs || item.needs.some((p) => user?.permissions.includes(p)));
  const addable = ADD_NEW.filter((item) => user?.permissions.includes(item.needs));

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    // Empty the service worker's caches too. Nothing private is stored there by
    // design, but on a shared phone the next person should not be able to page
    // back through what the last one was looking at.
    navigator.serviceWorker?.controller?.postMessage('clear-cache');
    router.push('/login');
    router.refresh();
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <UserContext.Provider value={user}>
      <div className="min-h-screen lg:grid lg:grid-cols-[232px_1fr]">
        <aside className={`border-r bg-white lg:block ${open ? 'block' : 'hidden'}`}>
          <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
            <div className="border-b p-4">
              <Link href="/crm" className="flex items-center gap-2.5">
                <Image src="/logo.png" alt="" width={40} height={40} className="h-10 w-10 object-contain" />
                <span>
                  <span className="display block text-sm leading-tight text-[var(--navy)]">HN PROPERTIES</span>
                  <span className="text-xs text-[var(--muted)]">Jabalpur</span>
                </span>
              </Link>
            </div>

            <nav className="flex-1 space-y-4 p-3">
              {GROUPS.map((group) => {
                const items = visible.filter((item) => item.group === group);
                if (!items.length) return null;
                return (
                  <div key={group}>
                    <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{group}</p>
                    <ul className="space-y-0.5">
                      {items.map((item) => {
                        const active = pathname === item.href || (item.href !== '/crm' && pathname.startsWith(item.href));
                        const badge = badgeFor(item.href);
                        const justChanged = flashing[item.href];
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                                active
                                  ? 'bg-[var(--navy)] font-semibold text-white'
                                  : justChanged
                                    ? 'animate-flash font-semibold text-[var(--danger)]'
                                    : badge
                                      ? // Anything waiting on a person stays tinted until it is dealt with.
                                        badge.tone === 'alert'
                                        ? 'bg-[#fdeaea] font-semibold text-[var(--danger)]'
                                        : badge.tone === 'warn'
                                          ? 'bg-[#fef6e7] font-semibold text-[#a5690a]'
                                          : 'bg-[var(--brand-soft)] font-semibold text-[var(--brand)]'
                                      : 'text-[var(--ink-soft)] hover:bg-[var(--paper)]'
                              }`}
                            >
                              <span className="text-base">{item.icon}</span>
                              <span className="flex-1">{item.label}</span>
                              {badge && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    active
                                      ? 'bg-white text-[var(--navy)]'
                                      : badge.tone === 'alert'
                                        ? 'bg-[var(--danger)] text-white'
                                        : badge.tone === 'warn'
                                          ? 'bg-[var(--accent)] text-[#5b3d02]'
                                          : 'bg-[var(--brand)] text-white'
                                  }`}
                                >
                                  {badge.count}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </nav>

            {/*
              Sits under the nav, below Settings, and only on mobile — the sidebar
              is a drawer at this width, and installing to a home screen is a phone
              gesture. On a laptop the browser's own address-bar control is the
              natural place for it.
            */}
            <div className="border-t p-3 lg:hidden">
              <button
                type="button"
                className="btn btn-ghost w-full py-2 text-sm"
                onClick={() => {
                  setOpen(false);
                  openInstallDialog();
                }}
              >
                Download HN Core App
              </button>
            </div>

            <div className="border-t p-3">
              <div className="flex items-center gap-2.5 rounded-lg bg-[var(--paper)] p-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--navy)] text-sm font-semibold text-white">
                  {(user?.name ?? '?').slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{user?.name ?? '—'}</span>
                  <span className="block text-xs text-[var(--muted)]">{user?.roleName ?? ''}</span>
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <Link href="/" className="btn btn-ghost flex-1 py-1.5 text-xs">Website</Link>
                <button type="button" onClick={signOut} className="btn btn-ghost flex-1 py-1.5 text-xs">Sign out</button>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-40 border-b bg-white">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
              <button type="button" className="btn btn-ghost py-2 lg:hidden" onClick={() => setOpen((v) => !v)}>☰</button>

              <div className="hidden min-w-[210px] xl:block">
                <p className="display text-lg leading-tight text-[var(--navy)]">
                  {greeting}, {(user?.name ?? '').split(' ')[0] || 'there'}
                </p>
                <p className="text-xs text-[var(--muted)]">Here&apos;s what is happening today.</p>
              </div>

              <GlobalSearch />

              <div className="relative">
                {addable.length > 0 && (
                  <button type="button" className="btn btn-navy whitespace-nowrap" onClick={() => setAddOpen((v) => !v)}>
                    + Add New
                  </button>
                )}
                {/*
                  Anchored left on a phone, right from sm up.

                  right-0 aligns the menu's right edge with the button's, which works
                  on a laptop where the button sits on the right of the bar. On a
                  phone the button is at the left, so a 224px menu ran off the left of
                  the screen and half the options were unreachable. The width cap
                  stops it overflowing the other way on a narrow phone.
                */}
                {addOpen && (
                  <div className="absolute left-0 z-[200] mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-xl border bg-white py-1.5 shadow-2xl sm:left-auto sm:right-0">
                    {addable.map((item) => (
                      <Link key={item.label} href={item.href} className="block px-4 py-2 text-sm hover:bg-[var(--paper)]">
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <SoundToggle subtleClicks className="rounded-lg border px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--ink)]" label="" />

              <p className="hidden whitespace-nowrap rounded-lg border px-3 py-2 text-sm text-[var(--muted)] 2xl:block">
                {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </header>

          <main className="p-4 lg:p-6">{children}</main>

          {/* Polls for changes and refreshes the page in place. */}
          <LivePulse onCounts={onCounts} />
        </div>
      </div>
    </UserContext.Provider>
  );
}

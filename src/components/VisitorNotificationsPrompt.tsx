'use client';

import { useCallback, useEffect, useState } from 'react';
import { currentPushState, enablePush, type VisitorCategory } from '@/lib/push-client';

/**
 * A dismissible bottom banner inviting anyone browsing — signed in or not — to turn
 * on notifications for new listings and Hot Deals. Separate from NotificationsToggle,
 * which is the owner/staff control buried in the account and CRM pages; this is the
 * visible, unmissable version aimed at every visitor, matching how the person asked
 * for it: "like how it works for every app," i.e. a real native alert once granted,
 * not a setting someone has to go hunting for.
 *
 * Shown once per device unless dismissed. Never shown again once a device is
 * already subscribed, already denied, or on a browser that cannot do Web Push
 * (currentPushState() already accounts for the iOS-needs-home-screen-install case).
 */

const DISMISSED_KEY = 'hn-visitor-push-dismissed';
const SHOW_DELAY_MS = 2500; // let the page settle before asking for anything

export default function VisitorNotificationsPrompt() {
  const [visible, setVisible] = useState(false);
  const [listings, setListings] = useState(true);
  const [hotDeals, setHotDeals] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISSED_KEY)) return;

    let alive = true;
    const timer = window.setTimeout(() => {
      currentPushState().then((state) => {
        if (alive && state === 'off') setVisible(true);
      });
    }, SHOW_DELAY_MS);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      /* private browsing or storage disabled — just hide for this session */
    }
  }, []);

  const enable = useCallback(async () => {
    const categories: VisitorCategory[] = [
      ...(listings ? (['LISTINGS'] as const) : []),
      ...(hotDeals ? (['HOT_DEALS'] as const) : []),
    ];
    if (!categories.length) {
      setError('Pick at least one to turn on.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const state = await enablePush('VISITOR', categories);
      if (state === 'on') {
        setDone(true);
        window.setTimeout(dismiss, 1800);
      } else if (state === 'denied') {
        setError('Notifications are blocked for this site in your browser settings.');
      } else {
        setError('Could not turn this on. Please try again.');
      }
    } catch {
      setError('Could not turn this on. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [listings, hotDeals, dismiss]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
      {/*
        Was using var(--surface) and var(--line) — neither exists in this project
        (the real names are --plate and --rule), so the browser silently fell back
        to nothing, which is why this rendered almost see-through. Rebuilt here as
        proper frosted glass: translucent white over backdrop-blur, opaque enough
        to stay readable over any page content behind it, matching the same glass
        treatment used in the mobile menu.
      */}
      <div className="w-full max-w-md rounded-2xl border border-white/80 bg-white/85 p-4 shadow-[0_12px_32px_-8px_rgba(16,35,60,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl backdrop-saturate-150">
        {done ? (
          <p className="text-center text-sm font-medium text-[var(--navy)]">
            🔔 You're all set — you'll get alerts on this device.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-lg">
                🔔
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[var(--navy)]">Never miss a property</p>
                <p className="mt-0.5 text-sm text-[var(--muted)]">
                  Get notified on this device for new listings and Hot Deals.
                </p>
              </div>
              <button
                type="button"
                onClick={dismiss}
                aria-label="Dismiss"
                className="shrink-0 rounded-lg px-2 py-1 text-[var(--muted)] hover:bg-black/5"
              >
                ✕
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--navy)]">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={listings} onChange={(e) => setListings(e.target.checked)} />
                New listings
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={hotDeals} onChange={(e) => setHotDeals(e.target.checked)} />
                Hot Deals
              </label>
            </div>

            {error && <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>}

            <div className="mt-3 flex gap-2">
              <button type="button" onClick={enable} disabled={busy} className="btn btn-primary flex-1 py-2 text-sm disabled:opacity-50">
                {busy ? 'Working…' : 'Enable notifications'}
              </button>
              <button type="button" onClick={dismiss} className="btn btn-ghost py-2 text-sm">
                Not now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

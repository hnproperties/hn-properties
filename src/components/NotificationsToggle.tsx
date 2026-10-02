'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  type Audience,
  type PushState,
  currentPushState,
  enablePush,
  disablePush,
} from '@/lib/push-client';

/**
 * One control for turning device notifications on or off, used by both the owner
 * area and the CRM. The only difference is the wording, which `Copy` supplies.
 *
 * The state shown is read from the browser, not from a prop — a subscription lives
 * on the device, so a page cannot know it from the server. That also makes it honest
 * across devices: switching it on here says "this device", never "everywhere".
 */

const COPY = {
  OWNER: {
    title: 'Notifications for your properties',
    blurb:
      'Get a quiet alert on this device when one of your properties is verified, published, or needs something from you. You can turn this off any time.',
    on: 'You will get alerts for your properties on this device.',
    off: 'Turn on to hear about your properties without checking the site.',
    denied: 'Notifications are blocked for this site. Allow them in your browser settings, then try again.',
    unsupported: 'This device or browser can’t show notifications. On iPhone, add the app to your home screen first.',
  },
  STAFF: {
    title: 'Desk alerts on this device',
    blurb:
      'Get a push when a new lead, submission, or owner request arrives — even with HN Core closed. Each person turns this on for their own phone.',
    on: 'This device will buzz for new leads, submissions and owner requests.',
    off: 'Turn on so the desk reaches you when the app is closed.',
    denied: 'Notifications are blocked. Allow them for this site in the browser, then try again.',
    unsupported: 'This device or browser can’t show notifications here.',
  },
} as const;

export default function NotificationsToggle({ audience }: { audience: Audience }) {
  const copy = COPY[audience];
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    currentPushState()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState('off'));
    return () => {
      alive = false;
    };
  }, []);

  const toggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = state === 'on' ? await disablePush() : await enablePush(audience);
      setState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }, [audience, busy, state]);

  // Before the browser has answered, render nothing rather than a button that would
  // flash from the wrong label to the right one.
  if (state === null) return null;

  const on = state === 'on';
  const disabled = busy || state === 'unsupported' || state === 'denied';

  const note = state === 'denied' ? copy.denied : state === 'unsupported' ? copy.unsupported : on ? copy.on : copy.off;

  return (
    <section className="plate flex flex-wrap items-center gap-4 p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-xl">
        🔔
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--navy)]">{copy.title}</p>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{note}</p>
        {error && <p className="mt-1 text-sm text-[var(--danger)]">{error}</p>}
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={on}
        className={`btn shrink-0 py-2 text-sm ${on ? 'btn-ghost' : 'btn-primary'} disabled:opacity-50`}
      >
        {busy ? 'Working…' : on ? 'Turn off' : 'Turn on'}
      </button>
    </section>
  );
}

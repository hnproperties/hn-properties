'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * Signs an owner out.
 *
 * The cookie is httpOnly, so it cannot be cleared from script — the request to the
 * server is what actually ends the session. `router.refresh()` afterwards discards
 * the cached server render, so no page can briefly show the previous session's
 * content on the way out.
 *
 * Red, but not a solid alarm-red block. Signing out is reversible and ordinary;
 * a soft red with dark red text marks it as the one destructive-feeling action on
 * the page without shouting over the form above it.
 */
export default function SignOutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch('/api/auth/owner-logout', { method: 'POST' });
    // The service worker keeps no private pages, but a shared phone should not let
    // the next person page back through what the last one was looking at.
    navigator.serviceWorker?.controller?.postMessage('clear-cache');
    router.push('/');
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className={`btn w-full border border-[var(--danger)]/25 bg-[#fdeaec] text-[var(--danger)] transition hover:bg-[#fbdadd] disabled:opacity-60 ${className}`}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

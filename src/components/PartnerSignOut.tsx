'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The logout endpoint clears the cookie and answers with JSON, so a plain form
 * post would leave the person staring at `{"data":{"ok":true}}`. Posting from
 * here lets us send them to the login page afterwards instead.
 */
export default function PartnerSignOut() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch('/api/auth/logout', { method: 'POST' });
        } finally {
          // Navigate regardless: if the request failed the cookie may still be
          // valid, and the login page will say so rather than leaving them stuck
          // on a page with no way out.
          router.push('/partner/login');
          router.refresh();
        }
      }}
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  );
}

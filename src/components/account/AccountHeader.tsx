'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

/**
 * The signed-in strip at the top of the owner area: who you are, and the way out.
 *
 * Sign-out clears the cookie server-side rather than in the browser, because the
 * cookie is httpOnly — script cannot touch it, which is the point of it being
 * httpOnly. `router.refresh()` afterwards throws away the cached server render so
 * the page cannot briefly show the previous session's content.
 */
export default function AccountHeader({
  name,
  email,
  photoUrl,
}: {
  name: string | null;
  email: string;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch('/api/auth/owner-logout', { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  const initial = (name ?? email).trim().charAt(0).toUpperCase();

  return (
    <div className="plate flex flex-wrap items-center gap-4 p-4">
      {photoUrl ? (
        // Google's own CDN, and only ever this one image — a plain img avoids
        // adding a remote host to the image optimiser for a 40px avatar.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-soft)] text-lg font-semibold text-[var(--brand)]">
          {initial}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{name ?? 'Your account'}</p>
        <p className="truncate text-sm text-[var(--muted)]">{email}</p>
      </div>

      <div className="flex gap-2">
        <Link href="/account/profile" className="btn btn-ghost py-2 text-sm">
          Profile
        </Link>
        <button type="button" className="btn btn-ghost py-2 text-sm" disabled={busy} onClick={signOut}>
          {busy ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );
}

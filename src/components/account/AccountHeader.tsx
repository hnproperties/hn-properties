'use client';

import Link from 'next/link';
import SignOutButton from './SignOutButton';

/** The signed-in strip at the top of the owner area: who you are, and the way out. */
export default function AccountHeader({
  name,
  email,
  photoUrl,
}: {
  name: string | null;
  email: string;
  photoUrl: string | null;
}) {
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
        {/* One implementation, so the two never drift apart on what signing out does. */}
        <SignOutButton className="w-auto py-2 text-sm" />
      </div>
    </div>
  );
}

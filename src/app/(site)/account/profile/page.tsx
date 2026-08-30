import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { currentOwner } from '@/lib/owner-session';
import ProfileForm from '@/components/account/ProfileForm';

export const metadata: Metadata = {
  title: 'Your profile',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const account = await currentOwner();
  if (!account) redirect('/sign-in?next=/account/profile');

  return (
    <div className="wrap max-w-xl py-10">
      <Link href="/account" className="text-sm text-[var(--brand)] hover:underline">
        ← Your listed properties
      </Link>

      <h1 className="display mt-3 text-2xl">Your profile</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        This is how we know who you are when you list a property with us.
      </p>

      <ProfileForm
        name={account.name}
        email={account.email}
        phone={account.phone}
        photoUrl={account.photoUrl}
      />
    </div>
  );
}

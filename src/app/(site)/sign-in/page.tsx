import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { site } from '@/lib/constants';
import { currentOwner } from '@/lib/owner-session';
import { GoogleIcon } from '@/components/SocialIcons';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to manage the properties you have listed with HN Properties.',
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  state: 'That sign-in link expired. Please try again.',
  exchange: "We couldn't complete sign-in with Google. Please try again.",
  unverified: 'That Google account has an unverified email address, so we cannot use it to sign in.',
  disabled: 'This account has been disabled. Please call us and we will sort it out.',
  cancelled: 'Sign-in was cancelled.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again shortly.',
};

const POINTS = [
  { icon: '🛡️', title: 'Verified', body: 'Properties' },
  { icon: '📍', title: 'Local Jabalpur', body: 'Expertise' },
  { icon: '👤', title: 'Personalised', body: 'Assistance' },
];

/**
 * Owner sign-in.
 *
 * Two layouts from one component: stacked on a phone, and a split view on a laptop
 * with the reassurance points and phone number beside the form rather than below
 * it. Both are the same markup at different breakpoints — a second component would
 * mean two places to keep a change in step.
 *
 * Deliberately not at /login: that belongs to staff, and one address that means two
 * different things is how someone eventually ends up at the wrong sign-in.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  // Already signed in — no reason to show a sign-in form.
  const owner = await currentOwner();
  if (owner) redirect('/account');

  const message = searchParams.error ? (ERRORS[searchParams.error] ?? ERRORS.exchange) : null;
  const next = searchParams.next && searchParams.next.startsWith('/') ? searchParams.next : '/account';
  const startUrl = `/api/auth/google/start?next=${encodeURIComponent(next)}`;

  return (
    <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[var(--navy)]">
      {/* The hero photograph, dimmed hard so white text stays readable over it. */}
      <Image src="/hero.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-25" />
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--navy)]/90 via-[var(--navy)]/80 to-[var(--navy)]/95" />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-10 lg:min-h-[calc(100vh-4rem)] lg:flex-row lg:items-center lg:gap-12 lg:py-16">
        {/* Reassurance column: under the form on a phone, beside it on a laptop. */}
        <aside className="order-3 mt-10 w-full max-w-md lg:order-1 lg:mt-0 lg:flex-1">
          <div className="divide-y divide-white/10">
            {POINTS.map((point) => (
              <div key={point.title} className="flex items-center gap-4 py-4">
                <span aria-hidden="true" className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-white/10 text-xl">
                  {point.icon}
                </span>
                <p className="text-base font-medium text-white">
                  {point.title}
                  <span className="block text-white/70">{point.body}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
            <p className="text-sm text-white/70">Talk to {site.name}</p>
            <a href={`tel:${site.phone}`} className="display mt-1 block text-2xl text-white">
              {site.phone}
            </a>
            <p className="mt-1 text-sm text-white/60">Your trusted property consultant</p>
          </div>
        </aside>

        <div className="order-1 w-full max-w-md lg:order-2 lg:flex-1">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5">
              <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 object-contain" />
              <span className="display text-lg tracking-tight text-[var(--navy)]">HN PROPERTIES</span>
            </span>

            <h1 className="display mt-6 text-3xl text-white">Welcome Back!</h1>
            <span aria-hidden="true" className="mx-auto mt-2 block h-1 w-12 rounded-full bg-[var(--accent)]" />
            <p className="mt-3 text-white/80">Sign in to your {site.name} account to continue</p>
          </div>

          <div className="mt-7 rounded-3xl bg-[var(--plate)] p-6 shadow-2xl sm:p-8">
            <h2 className="display text-center text-2xl">Sign In</h2>
            <p className="mt-1 text-center text-sm text-[var(--muted)]">Access your account</p>

            {message && (
              <p role="alert" className="mt-5 rounded-xl bg-[#fdeaec] px-4 py-3 text-sm text-[var(--danger)]">
                {message}
              </p>
            )}

            <a
              href={startUrl}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border py-3.5 text-base font-semibold transition hover:bg-black/[0.03]"
            >
              <GoogleIcon className="h-5 w-5" />
              Sign in with Google
            </a>

            {/*
              Phone sign-in is not offered yet rather than shown broken. Sending an
              OTP to an Indian number needs DLT registration with TRAI, and until
              that clears the messages are dropped by the carrier without any error —
              a button here would simply fail silently and look like our fault.
            */}
            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-black/10" />
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">Coming soon</span>
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <p className="mt-3 text-center text-sm text-[var(--muted)]">
              Signing in with your mobile number will be available shortly.
            </p>

            <p className="mt-6 border-t pt-5 text-center text-sm text-[var(--muted)]">
              Listed a property with us?{' '}
              <Link href="/post" className="font-semibold text-[var(--brand)]">
                Post your property
              </Link>{' '}
              and it will appear here.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

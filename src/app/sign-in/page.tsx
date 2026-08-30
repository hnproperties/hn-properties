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

/** The three reassurance points, in the order the mockups place them. */
const POINTS = [
  {
    title: 'Verified',
    body: 'Properties',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M12 2.5 4.5 5.8v5.4c0 4.6 3.2 8.9 7.5 10.3 4.3-1.4 7.5-5.7 7.5-10.3V5.8L12 2.5Z" fill="#f5a524" />
        <path d="m8.8 12.1 2.2 2.2 4.2-4.4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: 'Local Jabalpur',
    body: 'Expertise',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <path d="M12 2.5c-3.6 0-6.5 2.9-6.5 6.5 0 4.9 6.5 12.5 6.5 12.5s6.5-7.6 6.5-12.5c0-3.6-2.9-6.5-6.5-6.5Z" fill="#e6215a" />
        <circle cx="12" cy="9" r="2.4" fill="#fff" />
      </svg>
    ),
  },
  {
    title: 'Personalised',
    body: 'Assistance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
        <circle cx="12" cy="8" r="3.8" fill="#cbd5e1" />
        <path d="M4.6 20.5c0-4 3.3-6.3 7.4-6.3s7.4 2.3 7.4 6.3" fill="#cbd5e1" />
      </svg>
    ),
  },
];

/**
 * Owner sign-in.
 *
 * Deliberately outside the (site) route group, so it inherits no header and no
 * footer. A sign-in page with the full site navigation around it invites people to
 * wander off mid-task, and the mockups show it standing alone — one screen, one
 * thing to do.
 *
 * Not at /login either: that belongs to staff, and one address meaning two
 * different things is how someone eventually ends up at the wrong form.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string };
}) {
  const owner = await currentOwner();
  if (owner) redirect('/account');

  const message = searchParams.error ? (ERRORS[searchParams.error] ?? ERRORS.exchange) : null;
  const next = searchParams.next?.startsWith('/') ? searchParams.next : '/account';
  const startUrl = `/api/auth/google/start?next=${encodeURIComponent(next)}`;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0b2a52]">
      {/* Full-bleed night photograph, dimmed so white text holds up over it. */}
      <Image src="/hero.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b2a52]/95 via-[#0d2f5c]/85 to-[#0b2a52]/70" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:items-center lg:gap-16 lg:px-8">
        {/*
          The reassurance column. Beside the card on a laptop, and below it on a
          phone — where the mockup lays the three points out in a single row rather
          than stacking them, so they take one band of height instead of three.
        */}
        <aside className="order-3 mx-auto mt-10 w-full max-w-md lg:order-1 lg:mt-0 lg:max-w-sm">
          <div className="grid grid-cols-3 divide-x divide-white/15 lg:grid-cols-1 lg:divide-x-0 lg:divide-y">
            {POINTS.map((point) => (
              <div
                key={point.title}
                className="flex flex-col items-center gap-2 px-2 text-center lg:flex-row lg:gap-4 lg:px-0 lg:py-5 lg:text-left"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15"
                >
                  {point.icon}
                </span>
                <p className="text-sm font-semibold leading-tight text-white lg:text-base">
                  {point.title}
                  <span className="block font-normal text-white/70">{point.body}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center gap-4 rounded-2xl bg-white/[0.07] p-5 ring-1 ring-white/10">
            <span aria-hidden="true" className="flex h-14 w-14 flex-none items-center justify-center rounded-xl bg-white/10">
              <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                <path
                  d="M6.6 3.5c.6 0 1.1.4 1.3 1l1 3a1.4 1.4 0 0 1-.4 1.5l-1.2 1a11 11 0 0 0 5.7 5.7l1-1.2a1.4 1.4 0 0 1 1.5-.4l3 1c.6.2 1 .7 1 1.3v2.6c0 .8-.7 1.5-1.5 1.4C10.3 20 4 13.7 3.5 5.1A1.4 1.4 0 0 1 4.9 3.5h1.7Z"
                  fill="#e6215a"
                />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="text-sm text-white/70">Talk to {site.name}</p>
              <a href={`tel:${site.phone}`} className="display block text-2xl leading-tight text-white">
                {site.phone}
              </a>
              <p className="mt-0.5 text-sm text-white/60">Your trusted property consultant</p>
            </div>
          </div>
        </aside>

        <div className="order-1 mx-auto w-full max-w-md lg:order-2">
          <div className="text-center">
            <span className="inline-flex items-center gap-2.5 rounded-2xl bg-white px-5 py-3 shadow-lg">
              <Image src="/logo.png" alt="" width={34} height={34} className="h-8 w-8 object-contain" />
              <span className="display text-lg tracking-tight text-[#0b2a52]">HN PROPERTIES</span>
            </span>

            <h1 className="display mt-6 text-3xl text-white sm:text-4xl">Welcome Back!</h1>
            <span aria-hidden="true" className="mx-auto mt-3 block h-1 w-14 rounded-full bg-[#f5a524]" />
            <p className="mx-auto mt-4 max-w-xs text-white/85">
              Sign in to your {site.name} account to continue
            </p>
          </div>

          <div className="mt-7 rounded-[26px] bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="display text-center text-2xl text-[#0b2a52]">Sign In</h2>
            <p className="mt-1 text-center text-[var(--muted)]">Access your account</p>

            {message && (
              <p role="alert" className="mt-5 rounded-xl bg-[#fdeaec] px-4 py-3 text-sm text-[var(--danger)]">
                {message}
              </p>
            )}

            <a
              href={startUrl}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 py-4 text-base font-semibold text-[#0b2a52] transition hover:bg-black/[0.03]"
            >
              <GoogleIcon className="h-5 w-5" />
              Sign in with Google
            </a>

            {/*
              The mockup shows a mobile number and password above this. Neither is
              built: sign-in is by one-time code, not a password, and sending a code
              to an Indian number needs DLT clearance first. Fields that look ready
              and silently fail are worse than fields that are honestly not here yet,
              so the space says what is coming instead.
            */}
            <div className="mt-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-black/10" />
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--muted)]">Coming soon</span>
              <span className="h-px flex-1 bg-black/10" />
            </div>

            <p className="mt-4 text-center text-sm text-[var(--muted)]">
              Signing in with your mobile number will be available shortly.
            </p>

            <p className="mt-7 border-t pt-5 text-center text-sm text-[var(--muted)]">
              Listed a property with us?{' '}
              <Link href="/post" className="font-semibold text-[#f5a524]">
                Post your property
              </Link>{' '}
              and it will appear here.
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-white/60">
            <Link href="/" className="hover:text-white">
              ← Back to HN Properties
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

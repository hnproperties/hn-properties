import Link from 'next/link';
import Image from 'next/image';
import { site } from '@/lib/constants';

/** Shared frame for both sign-in pages: brand panel on the left, form on the right. */
export default function LoginShell({
  eyebrow,
  title,
  intro,
  footer,
  points,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  footer: React.ReactNode;
  points?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — the hero photograph under a heavy navy wash. */}
      <div
        className="relative hidden flex-col justify-between p-14 text-white lg:flex"
        style={{
          backgroundImage:
            'linear-gradient(160deg, rgba(9,35,67,0.93) 0%, rgba(9,35,67,0.86) 55%, rgba(14,47,90,0.9) 100%), url(/hero.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white">
            <Image src="/logo.png" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
          </span>
          <span>
            <span className="display block text-2xl text-white">HN PROPERTIES</span>
            <span className="block text-sm text-white/60">{site.city} Property Marketplace</span>
          </span>
        </Link>

        <div className="animate-rise">
          <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">{eyebrow}</p>
          <h1 className="display mt-4 text-4xl leading-tight text-white">{title}</h1>
          <p className="mt-4 max-w-lg text-white/75">{intro}</p>

          {points && points.length > 0 && (
            <ul className="mt-10 grid gap-4 sm:grid-cols-2">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-white/85">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-sm text-white/50">
          Private system. Every sign-in and record change is written to the audit log.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-lg">
          <Link href="/" className="mb-10 flex items-center gap-3 lg:hidden">
            <Image src="/logo.png" alt="" width={48} height={48} className="h-12 w-12 object-contain" />
            <span className="display text-xl text-[var(--navy)]">HN PROPERTIES</span>
          </Link>

          <h2 className="display text-3xl text-[var(--navy)]">{title}</h2>
          <p className="mt-2.5 text-[var(--muted)]">{intro}</p>

          <div className="glass-card animate-rise mt-8 p-8">{children}</div>

          <div className="mt-6 text-[var(--muted)]">{footer}</div>
        </div>
      </div>
    </div>
  );
}

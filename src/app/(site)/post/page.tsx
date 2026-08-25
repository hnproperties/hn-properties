import type { Metadata } from 'next';
import Link from 'next/link';
import { site, waLink } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Post your property',
  description: `List your property for sale or on rent with ${site.name} in ${site.city}.`,
  alternates: { canonical: '/post' },
};

const OPTIONS = [
  {
    href: '/sell',
    icon: '🏷️',
    tint: 'bg-[#e8f4fa] text-[#106a94]',
    title: 'I want to sell',
    body: 'We value it against recent transactions in your locality, verify it, photograph it properly and bring you qualified buyers.',
    points: ['Honest asking range, not an inflated one', 'Buyers screened before they visit', 'Negotiation, agreement and registration handled'],
    cta: 'Sell my property',
  },
  {
    href: '/give-on-rent',
    icon: '🔑',
    tint: 'bg-[#e8f6ed] text-[#16a34a]',
    title: 'I want to give it on rent',
    body: 'We screen tenants before the first viewing, agree the rent against current market rates, and put a proper agreement in place.',
    points: ['Tenants checked before they see the property', 'Deposit, lock-in and escalation set properly', 'Commercial leasing handled too'],
    cta: 'List for rent',
  },
];

export default function PostPropertyPage() {
  return (
    <div className="wrap py-14">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">Owners</p>
        <h1 className="display mt-2 text-3xl text-[var(--navy)] sm:text-4xl">Post your property</h1>
        <p className="mt-3 text-lg text-[var(--muted)]">
          Which of these are you after? Both take about two minutes, and nothing appears on the website until
          our team has spoken to you and checked the details.
        </p>
      </div>

      <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
        {OPTIONS.map((option) => (
          <Link key={option.href} href={option.href} className="tile group p-7">
            <span className={`tile-icon ${option.tint}`}>{option.icon}</span>
            <h2 className="display text-2xl text-[var(--navy)]">{option.title}</h2>
            <p className="text-[var(--muted)]">{option.body}</p>

            <ul className="mt-2 space-y-2">
              {option.points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-[var(--ink-soft)]">
                  <span className="mt-0.5 text-[var(--ok)]">✓</span>
                  {point}
                </li>
              ))}
            </ul>

            <span className="btn btn-primary mt-4 self-start">{option.cta} →</span>
          </Link>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-3xl text-center text-[var(--muted)]">
        <p>
          Not sure which applies, or would rather just talk? Call{' '}
          <a href={`tel:${site.phone}`} className="link-underline font-semibold">{site.phone}</a>, message us on{' '}
          <a href={waLink(site.whatsapp, `Hello ${site.name}, I would like to list my property.`)} className="link-underline font-semibold" target="_blank" rel="noopener noreferrer">
            WhatsApp
          </a>
          {site.email && (
            <>
              , or email <a href={`mailto:${site.email}`} className="link-underline font-semibold">{site.email}</a>
            </>
          )}
          .
        </p>
        <p className="mt-4 text-sm">
          Your contact details stay with us. We never publish an owner&apos;s name or number on a listing.
        </p>
      </div>
    </div>
  );
}

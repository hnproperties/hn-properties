'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { site, waLink } from '@/lib/constants';
import { InstagramIcon, WhatsAppIcon, PhoneIcon } from './SocialIcons';

/**
 * `accent` marks the two shelves we want people to notice: Property Demand
 * (buyers already looking) and Hot Deals. They render as solid coloured buttons
 * in every state rather than plain text links, so they read as calls to action
 * instead of ordinary navigation.
 */
const NAV = [
  { href: '/', label: 'Home' },
  { href: '/buy', label: 'Buy' },
  { href: '/rent', label: 'Rent' },
  // menuOnly: kept out of the desktop bar for room, but still in the mobile menu
  // and the footer. The "Post Your Property" button covers both journeys anyway.
  { href: '/sell', label: 'Sell', menuOnly: true },
  { href: '/give-on-rent', label: 'Give on Rent', menuOnly: true },
  { href: '/hot-deals', label: '🔥 Hot Deals', accent: 'fire' as const },
  { href: '/wanted', label: '🥇 Property Demand', accent: 'gold' as const },
  { href: '/requirement', label: 'Requirements' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const ACCENT_CLASS = {
  fire: 'bg-gradient-to-r from-[#e8590c] to-[#f08c00] text-white shadow-[0_4px_14px_-4px_rgba(232,89,12,0.65)] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_rgba(232,89,12,0.75)]',
  gold: 'bg-gradient-to-r from-[#b8860b] to-[#d4a017] text-white shadow-[0_4px_14px_-4px_rgba(184,134,11,0.6)] hover:-translate-y-0.5 hover:shadow-[0_6px_18px_-4px_rgba(184,134,11,0.7)]',
} as const;

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="wrap flex h-[68px] items-center justify-between gap-4">
        {/* whitespace-nowrap throughout: at narrower widths the labels were breaking
            across three lines and pushing the whole header out of shape. */}
        <Link href="/" className="group flex min-w-0 shrink items-center gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={80}
            height={80}
            className="h-11 w-11 shrink-0 object-contain transition-transform duration-500 group-hover:scale-105"
            priority
          />
          {/* min-w-0 + truncate on the tagline: if the nav ever needs more room,
              this line shortens instead of the nav overflowing into the buttons
              on the right, which is what caused the overlap before. */}
          <span className="min-w-0 leading-tight">
            <span className="display block whitespace-nowrap text-xl text-[var(--navy)]">HN PROPERTIES</span>
            <span className="block truncate text-sm text-[var(--muted)]">{site.city} Property Marketplace</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 2xl:flex 2xl:gap-2">
          {NAV.filter((item) => !item.menuOnly).map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const accent = item.accent ? ACCENT_CLASS[item.accent] : null;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition duration-300 ${
                  accent
                    ? `${accent} ${active ? 'ring-2 ring-[var(--navy)] ring-offset-1' : ''}`
                    : active
                      ? 'bg-[var(--brand)] text-white shadow-[0_4px_14px_-4px_rgba(21,131,181,0.6)]'
                      : 'text-[var(--ink-soft)] hover:-translate-y-0.5 hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          {site.instagram && (
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow HN Properties on Instagram"
              className="hidden h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-md transition duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:inline-flex"
            >
              <InstagramIcon className="h-6 w-6" />
            </a>
          )}

          <a
            href={waLink(site.whatsapp, `Hello ${site.name}, I would like to enquire about a property.`)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat with us on WhatsApp"
            title="Chat on WhatsApp"
            className="hidden h-11 w-11 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-md transition duration-300 hover:-translate-y-0.5 hover:bg-[#1eb355] hover:shadow-lg sm:inline-flex"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>

          <a
            href={`tel:${site.phone}`}
            aria-label={`Call ${site.name} on ${site.phone}`}
            title={`Call ${site.phone}`}
            className="hidden h-11 w-11 items-center justify-center rounded-xl bg-[var(--navy)] text-white shadow-md transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--navy-deep)] hover:shadow-lg sm:inline-flex"
          >
            <PhoneIcon className="h-6 w-6" />
          </a>

          <Link href="/post" className="btn btn-primary sheen hidden whitespace-nowrap px-4 py-2.5 md:inline-flex">
            Post Your Property
          </Link>

          <button
            type="button"
            className="btn btn-ghost 2xl:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <nav id="site-menu" className="animate-rise border-t bg-white 2xl:hidden">
          <div className="wrap grid grid-cols-2 gap-1 py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={
                  item.accent
                    ? `col-span-2 rounded-lg px-3 py-3 text-center font-semibold ${ACCENT_CLASS[item.accent]}`
                    : 'rounded-lg px-3 py-3 hover:bg-[var(--brand-soft)]'
                }
              >
                {item.label}
              </Link>
            ))}
            <Link href="/post" onClick={() => setOpen(false)} className="btn btn-primary col-span-2 mt-1">
              Post Your Property
            </Link>
            <a href={`tel:${site.phone}`} className="col-span-2 rounded-lg px-3 py-3 font-semibold text-[var(--brand)]">
              Call {site.phone}
            </a>
            {site.instagram && (
              <a
                href={site.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="col-span-2 flex items-center gap-2 rounded-lg px-3 py-3 font-semibold text-[var(--ink-soft)]"
              >
                <InstagramIcon className="h-5 w-5" /> Follow us on Instagram
              </a>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}

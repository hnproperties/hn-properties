'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { site, waLink } from '@/lib/constants';
import { InstagramIcon, WhatsAppIcon, PhoneIcon } from './SocialIcons';

type NavItem = {
  href: string;
  label: string;
  accent?: 'gold';
  /** Rendered as the Hot Deals artwork rather than a styled text label. */
  artwork?: boolean;
  children?: { href: string; label: string; hint: string }[];
};

/**
 * `accent` marks the two shelves we want people to notice: Property Demand
 * (buyers already looking) and Hot Deals. They render as solid coloured buttons
 * rather than plain text links, so they read as calls to action.
 *
 * `children` turns an item into a dropdown. Buy / Rent / Sell / Give on Rent are
 * four halves of one idea, so they sit under a single "Properties" trigger — six
 * top-level items instead of nine, which is what lets the two accent buttons fit
 * without crowding the header.
 */
const NAV: NavItem[] = [
  { href: '/', label: 'Home' },
  {
    href: '/properties',
    label: 'Properties',
    children: [
      { href: '/buy', label: 'Buy', hint: 'Find your next home or investment' },
      { href: '/rent', label: 'Rent', hint: 'Residential and commercial rentals' },
      { href: '/sell', label: 'Sell', hint: 'List your property for sale' },
      { href: '/give-on-rent', label: 'Give on Rent', hint: 'Find a screened tenant' },
    ],
  },
  { href: '/hot-deals', label: 'Hot Deals', artwork: true },
  { href: '/wanted', label: '🥇 Property Demand', accent: 'gold' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

const ACCENT_CLASS = {
  gold: 'border border-white/90 bg-gradient-to-br from-white to-[#e7ecf3] text-[var(--navy)] shadow-[5px_5px_11px_rgba(163,177,198,0.5),-5px_-5px_11px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.9)] hover:shadow-[7px_7px_14px_rgba(163,177,198,0.55),-7px_-7px_14px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] hover:-translate-y-0.5',
} as const;

/**
 * Soft-extruded pill: a light shadow up-left, a darker one down-right, plus a thin
 * inner highlight along the top edge. Hover deepens both shadows so the button
 * appears to rise; the active state inverts them so it appears pressed in.
 */
const GLASS =
  'border border-white/80 bg-gradient-to-br from-white to-[#e9edf3] text-[var(--ink-soft)] shadow-[5px_5px_11px_rgba(163,177,198,0.45),-5px_-5px_11px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.85)] hover:-translate-y-0.5 hover:text-[var(--brand)] hover:shadow-[7px_7px_14px_rgba(163,177,198,0.5),-7px_-7px_14px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)]';

/**
 * Menu tiles need more definition than the header pills: the sheet behind them
 * is the same near-white, so a faint blue tint, a firmer border and a deeper
 * shadow are what separate one tile from the next.
 */
const MENU_TILE =
  'border border-white/90 bg-gradient-to-br from-white to-[#dfe6f0] text-[var(--navy)] shadow-[4px_4px_10px_rgba(120,140,170,0.38),-3px_-3px_8px_rgba(255,255,255,1),inset_0_1px_0_rgba(255,255,255,0.9)] active:scale-[0.97]';

const GLASS_ACTIVE =
  'border border-white/50 bg-[#e6eaf1] text-[var(--brand)] shadow-[inset_4px_4px_9px_rgba(163,177,198,0.6),inset_-4px_-4px_9px_rgba(255,255,255,0.95)]';

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);
  const pathname = usePathname();

  // Close both menus whenever the route changes. Without this, navigating from
  // inside the dropdown leaves it hanging open over the new page.
  useEffect(() => {
    setDropdown(null);
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-white/60 bg-[#eef1f6]/85 backdrop-blur-xl backdrop-saturate-150">
      <div className="wrap flex h-[68px] items-center justify-between gap-4">
        {/* whitespace-nowrap throughout: at narrower widths the labels were breaking
            across three lines and pushing the whole header out of shape. */}
        <Link href="/" className="group flex min-w-0 shrink items-center gap-2 xl:shrink-0 xl:gap-3">
          <Image
            src="/logo.png"
            alt=""
            width={80}
            height={80}
            className="h-10 w-10 shrink-0 object-contain transition-transform duration-500 group-hover:scale-105 xl:h-14 xl:w-14"
            priority
          />
          {/* min-w-0 + truncate on the tagline: if the nav ever needs more room,
              this line shortens instead of the nav overflowing into the buttons
              on the right, which is what caused the overlap before. */}
          <span className="min-w-0 leading-tight">
            <span className="display block truncate text-[15px] text-[var(--navy)] sm:text-[17px] xl:whitespace-nowrap xl:text-[19px]">HN PROPERTIES</span>
            <span className="hidden truncate text-sm text-[var(--muted)] sm:block xl:hidden 2xl:block">{site.city} Property Marketplace</span>
          </span>
        </Link>

        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-6 xl:flex 2xl:gap-8">
          {NAV.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const accent = item.accent ? ACCENT_CLASS[item.accent] : null;
            const childActive = item.children?.some((c) => pathname.startsWith(c.href));

            const base =
              'whitespace-nowrap rounded-[14px] px-3.5 py-2 text-[13.5px] font-semibold transition duration-300 2xl:px-4';
            const stateClass = accent
              ? `${accent} ${active ? 'ring-2 ring-white/70 ring-offset-2 ring-offset-transparent' : ''}`
              : active || childActive
                ? GLASS_ACTIVE
                : GLASS;

            if (item.children) {
              const isOpen = dropdown === item.href;
              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => setDropdown(item.href)}
                  onMouseLeave={() => setDropdown(null)}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    onClick={() => setDropdown(isOpen ? null : item.href)}
                    className={`${base} ${stateClass} inline-flex items-center gap-1`}
                  >
                    {item.label}
                    <span aria-hidden className={`text-[10px] transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  </button>

                  {isOpen && (
                    <div
                      className="absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 pt-2"
                      role="menu"
                    >
                      <div className="overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white to-[#eaeef4] p-2 shadow-[8px_8px_20px_rgba(163,177,198,0.5),-8px_-8px_20px_rgba(255,255,255,0.95),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            role="menuitem"
                            onClick={() => setDropdown(null)}
                            className={`block rounded-xl px-4 py-3 transition ${
                              pathname.startsWith(child.href)
                                ? 'bg-[var(--brand-soft)]'
                                : 'hover:bg-[var(--brand-soft)]'
                            }`}
                          >
                            <span className="block text-[17px] font-semibold text-[var(--navy)]">{child.label}</span>
                            <span className="mt-0.5 block text-[13.5px] leading-snug text-[var(--ink-soft)]">{child.hint}</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            if (item.artwork) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className={`shrink-0 rounded-xl px-1 transition duration-300 hover:-translate-y-0.5 hover:scale-105 ${
                    active ? 'ring-2 ring-[#ff5a00]/60 ring-offset-2 ring-offset-transparent' : ''
                  }`}
                >
                  {/* The artwork carries its own colour and depth, so it needs no
                      pill behind it — just a soft shadow to lift it off the glass. */}
                  <Image
                    src="/hot-deals-banner.png"
                    alt=""
                    width={1000}
                    height={563}
                    priority
                    className="h-11 w-auto drop-shadow-[0_3px_9px_rgba(220,38,0,0.45)] 2xl:h-12"
                  />
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href} className={`${base} ${stateClass}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Hot Deals stays visible on phones — it is the loudest thing we have
            and hiding it behind the menu wastes it. */}
        <Link href="/hot-deals" aria-label="Hot Deals" className="ml-auto shrink-0 xl:hidden">
          <Image
            src="/hot-deals-banner.png"
            alt=""
            width={1000}
            height={563}
            className="h-8 w-auto drop-shadow-[0_2px_6px_rgba(220,38,0,0.4)]"
          />
        </Link>

        <div className="flex shrink-0 items-center gap-2 xl:gap-2">
          {site.instagram && (
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow HN Properties on Instagram"
              className="hidden h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white shadow-md transition duration-300 hover:-translate-y-0.5 hover:shadow-lg sm:inline-flex xl:hidden 2xl:inline-flex"
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
            className="hidden h-11 w-11 items-center justify-center rounded-xl bg-[#25D366] xl:inline-flex text-white shadow-md transition duration-300 hover:-translate-y-0.5 hover:bg-[#1eb355] hover:shadow-lg"
          >
            <WhatsAppIcon className="h-6 w-6" />
          </a>

          <a
            href={`tel:${site.phone}`}
            aria-label={`Call ${site.name} on ${site.phone}`}
            title={`Call ${site.phone}`}
            className="hidden h-11 w-11 items-center justify-center rounded-xl bg-[var(--navy)] xl:inline-flex text-white shadow-md transition duration-300 hover:-translate-y-0.5 hover:bg-[var(--navy-deep)] hover:shadow-lg"
          >
            <PhoneIcon className="h-6 w-6" />
          </a>

          <Link
            href="/search"
            aria-label="Search properties by code or keyword"
            title="Search by property code"
            className="hidden h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-gradient-to-br from-white to-[#e9edf3] text-[var(--navy)] shadow-[3px_3px_8px_rgba(163,177,198,0.45),-3px_-3px_8px_rgba(255,255,255,0.95)] transition duration-300 hover:-translate-y-0.5 hover:text-[var(--brand)] xl:inline-flex"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" strokeLinecap="round" />
            </svg>
          </Link>

          <Link href="/post" className="btn btn-primary sheen hidden whitespace-nowrap px-4 py-2.5 md:inline-flex">
            Post Your Property
          </Link>

          <button
            type="button"
            className="btn btn-ghost xl:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="site-menu"
          >
            Menu
          </button>
        </div>
      </div>

      {open && (
        <nav id="site-menu" className="animate-rise border-t border-white/60 bg-[#eef1f6] xl:hidden">
          <div className="wrap space-y-4 py-4">
            <form action="/search" className="flex gap-2">
              <input
                type="search"
                name="q"
                placeholder="Property code or locality"
                aria-label="Search properties"
                className="field min-w-0 flex-1"
              />
              <button type="submit" className="btn btn-primary shrink-0" onClick={() => setOpen(false)}>
                Search
              </button>
            </form>

            {/* Every destination as an equal glass tile, in two even columns —
                the old mix of bare links, a centred image and one wide button
                read as a jumble. Dropdown parents are flattened so nothing is
                two taps away. */}
            <div className="grid grid-cols-2 gap-3">
              {NAV.flatMap((item) =>
                item.children
                  ? item.children.map((child) => ({ href: child.href, label: child.label, artwork: false }))
                  : [{ href: item.href, label: item.label, artwork: !!item.artwork }],
              ).map((entry) => (
                <Link
                  key={entry.href}
                  href={entry.href}
                  onClick={() => setOpen(false)}
                  className={`flex min-h-[46px] items-center justify-center rounded-[13px] px-3 py-2 text-center text-[13.5px] font-semibold transition ${
                    pathname === entry.href ? GLASS_ACTIVE : MENU_TILE
                  }`}
                >
                  {entry.artwork ? (
                    <Image src="/hot-deals-banner.png" alt="Hot Deals" width={1000} height={563} className="h-7 w-auto" />
                  ) : (
                    entry.label
                  )}
                </Link>
              ))}
              <Link
                href="/requirement"
                onClick={() => setOpen(false)}
                className={`flex min-h-[46px] items-center justify-center rounded-[13px] px-3 py-2 text-center text-[13.5px] font-semibold transition ${MENU_TILE}`}
              >
                Requirements
              </Link>
            </div>

            <Link href="/post" onClick={() => setOpen(false)} className="btn btn-primary w-full">
              Post Your Property
            </Link>

            <div className="flex items-center justify-center gap-5 pt-1 text-sm">
              <a href={`tel:${site.phone}`} className="font-semibold text-[var(--brand)]">
                Call {site.phone}
              </a>
              {site.instagram && (
                <a href={site.instagram} target="_blank" rel="noopener noreferrer" className="text-[var(--muted)]">
                  Instagram
                </a>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { openInstallDialog } from '@/components/PwaSetup';
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
      // Sits with the two listing actions because it is where those end up. Shown
      // to everyone: someone not signed in is sent to sign in and then straight
      // back here, which is a clearer route in than hiding the link until they are.
      { href: '/account', label: 'Your Listed Properties', hint: 'See and manage what you have listed' },
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
          <span className="shrink-0 rounded-xl bg-white p-1 shadow-sm xl:rounded-none xl:bg-transparent xl:p-0 xl:shadow-none">
            <Image
              src="/logo.png"
              alt=""
              width={80}
              height={80}
              className="h-12 w-12 object-contain transition-transform duration-500 group-hover:scale-105 xl:h-14 xl:w-14"
              priority
            />
          </span>
          {/* min-w-0 + truncate on the tagline: if the nav ever needs more room,
              this line shortens instead of the nav overflowing into the buttons
              on the right, which is what caused the overlap before. */}
          <span className="min-w-0 leading-tight">
            <span className="display block truncate text-[15px] text-[var(--navy)] sm:text-[16px] xl:whitespace-nowrap xl:text-[19px]">HN PROPERTIES</span>
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
            className="h-11 w-auto drop-shadow-[0_0_5px_rgba(255,120,40,0.5)]"
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

            {/*
              Three bands, most-used first: where you are and who you are, then
              everywhere else, then the three actions.

              Home and Profile lead because they are the two anyone reaches for
              without reading — so they get their own row at a larger size, and
              Profile is tinted to separate it from the plain destinations below.
            */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className={`flex min-h-[52px] items-center justify-center rounded-[13px] px-3 py-2 text-center text-[15px] font-semibold transition ${
                  pathname === '/' ? GLASS_ACTIVE : MENU_TILE
                }`}
              >
                Home
              </Link>
              <Link
                href="/account/profile"
                onClick={() => setOpen(false)}
                className="flex min-h-[52px] items-center justify-center rounded-[13px] border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-3 py-2 text-center text-[15px] font-semibold text-[var(--brand)] transition active:scale-[0.97]"
              >
                Profile
              </Link>
            </div>

            {/*
              Everything else, flattened out of the dropdowns so nothing is two taps
              away. Home is filtered out because it now has its own row above, and
              /account because it is one of the three actions at the bottom — it
              appeared in both places until now.
            */}
            <div className="grid grid-cols-2 gap-3">
              {NAV.flatMap((item) =>
                item.children
                  ? item.children.map((child) => ({ href: child.href, label: child.label, artwork: false }))
                  : [{ href: item.href, label: item.label, artwork: !!item.artwork }],
              )
                .filter((entry) => entry.href !== '/' && entry.href !== '/account')
                .map((entry) => (
                  <Link
                    key={entry.href}
                    href={entry.href}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-[46px] items-center justify-center rounded-[13px] px-3 py-2 text-center text-[13.5px] font-semibold transition ${
                      pathname === entry.href ? GLASS_ACTIVE : MENU_TILE
                    }`}
                  >
                    {entry.artwork ? (
                      <Image src="/hot-deals-banner.png" alt="Hot Deals" width={1000} height={563} className="h-9 w-auto" />
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

            {/*
              The three actions, each a different colour so they are told apart at a
              glance: brand blue to list, gold to manage what is listed, navy to
              install. All one size up from the tiles above, because these are the
              things people came to the menu to do.
            */}
            <Link href="/post" onClick={() => setOpen(false)} className="btn btn-primary w-full text-lg">
              Post Your Property
            </Link>

            <Link href="/account" onClick={() => setOpen(false)} className="btn btn-accent w-full text-lg">
              Your Listed Properties
            </Link>

            {/*
              Only in the mobile menu: installing to a home screen is a phone
              gesture, and this panel is already mobile-only, so it needs no
              breakpoint of its own.
            */}
            <button
              type="button"
              className="btn btn-navy w-full text-lg"
              onClick={() => {
                setOpen(false);
                openInstallDialog();
              }}
            >
              Download Our App
            </button>

            {/*
              Two separate destinations, so they get room to be told apart. Set side
              by side in small grey text they read as one line and are easy to hit by
              mistake — each is now its own full-width row at a comfortable tap size,
              with an icon to make the difference obvious at a glance.
            */}
            <div className="mt-1 flex flex-col gap-2.5 border-t pt-4">
              <a
                href={`tel:${site.phone}`}
                className="flex items-center justify-center gap-3 rounded-xl bg-[var(--brand-soft)] py-3.5 text-lg font-semibold text-[var(--brand)]"
              >
                <PhoneIcon className="h-6 w-6" />
                Call {site.phone}
              </a>
              {site.instagram && (
                <a
                  href={site.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 rounded-xl py-3.5 text-lg font-semibold ring-1 ring-black/5"
                >
                  <InstagramIcon className="h-6 w-6 text-[#C13584]" />
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

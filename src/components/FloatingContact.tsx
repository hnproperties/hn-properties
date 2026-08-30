'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { site, waLink } from '@/lib/constants';
import { WhatsAppIcon, PhoneIcon } from './SocialIcons';

/**
 * Sticky contact buttons. Most visitors arrive on a phone, so the two things they
 * are most likely to want — a WhatsApp message and a call — stay within thumb reach.
 *
 * The listing actions sit behind a single "+" rather than becoming buttons of their
 * own. Four stacked circles come to roughly 250px down the right edge, which on a
 * phone is about two fifths of the screen and lands squarely on top of the hero
 * cards. One button that opens a labelled menu costs an extra tap on the actions
 * people use least, and gives back the screen space on every other page.
 *
 * The menu holds the two listing actions and nothing else. Following on Instagram
 * is a different kind of intention from listing a property, and mixing them made
 * the menu read as a list of odds and ends; Instagram sits in the header menu,
 * where the rest of the site's links live.
 *
 * Mobile only, deliberately. On a laptop the header already carries Sell, Give on
 * Rent and Instagram, so repeating them in a floating menu would be clutter with
 * nothing to justify it.
 */
export default function FloatingContact() {
  const [nudge, setNudge] = useState(false);
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setNudge(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Escape closes the menu and returns focus to the button that opened it, so a
  // keyboard or screen-reader user is not left somewhere with no way back.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const actions = [
    { href: '/sell', label: 'Sell Property', hint: 'List your property for sale', icon: '🏷️' },
    { href: '/give-on-rent', label: 'Give on Rent', hint: 'Find a screened tenant', icon: '📋' },
  ];

  return (
    <>
      {/* Catches the tap that closes the menu, and dims the page so the choices read clearly. */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 sm:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 print:hidden">
        {open && (
          <div className="flex w-64 flex-col gap-2.5 sm:hidden" role="menu" aria-label="List your property">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3.5 rounded-2xl bg-[var(--plate)] px-4 py-4 shadow-xl ring-1 ring-black/5"
              >
                <span aria-hidden="true" className="text-2xl">{action.icon}</span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold">{action.label}</span>
                  <span className="block text-sm text-[var(--muted)]">{action.hint}</span>
                </span>
              </Link>
            ))}
          </div>
        )}

        <button
          ref={toggleRef}
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close menu' : 'Sell or give your property on rent'}
          onClick={() => setOpen((value) => !value)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)] text-white shadow-xl transition hover:bg-[var(--brand-dark)] sm:hidden"
        >
          {/* Rotating the same glyph into a cross keeps one shape rather than swapping icons. */}
          <span
            aria-hidden="true"
            className={`text-3xl font-light leading-none transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
          >
            +
          </span>
        </button>

        <a
          href={`tel:${site.phone}`}
          aria-label={`Call ${site.name} on ${site.phone}`}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--navy)] text-white shadow-xl transition hover:bg-[var(--navy-deep)] sm:hidden"
        >
          <PhoneIcon className="h-7 w-7" />
        </a>

        <a
          href={waLink(site.whatsapp, `Hello ${site.name}, I would like to enquire about a property.`)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          className="group flex items-center gap-2.5 rounded-full bg-[#25D366] py-3.5 pl-3.5 pr-3.5 text-white shadow-[0_10px_30px_-8px_rgba(37,211,102,0.8)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#1eb355] sm:pr-6"
        >
          <WhatsAppIcon className="h-8 w-8" />
          <span className={`hidden text-base font-semibold sm:inline ${nudge ? '' : 'opacity-0'} transition-opacity`}>
            Chat on WhatsApp
          </span>
        </a>
      </div>
    </>
  );
}

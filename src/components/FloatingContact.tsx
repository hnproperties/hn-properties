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
          className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#ffdf9e] via-[var(--accent)] to-[#d9860f] text-[#3d2708] shadow-[0_10px_28px_-6px_rgba(245,165,36,0.75),inset_0_1px_1px_rgba(255,255,255,0.7),inset_0_-4px_7px_rgba(0,0,0,0.22)] transition hover:-translate-y-0.5 sm:hidden"
        >
          {/* The glossy "ceramic" highlight — a soft blurred ellipse near the top,
              mimicking light catching a rounded, glazed surface. Same treatment on
              all three buttons below. */}
          <span aria-hidden="true" className="pointer-events-none absolute left-[16%] top-[10%] h-[40%] w-[60%] rounded-full bg-white/50 blur-[3px]" />
          {/*
            Drawn rather than typed. A "+" character is sized and centred by whatever
            font happens to load, so it never quite sits in the middle of the circle;
            two lines are exactly the size asked for and rotate cleanly into a cross,
            which keeps one shape instead of swapping icons on open.
          */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className={`relative h-8 w-8 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        <a
          href={`tel:${site.phone}`}
          aria-label={`Call ${site.name} on ${site.phone}`}
          className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-b from-[#2f5f9e] via-[var(--navy)] to-[#061a33] text-white shadow-[0_10px_28px_-6px_rgba(14,47,90,0.75),inset_0_1px_1px_rgba(255,255,255,0.35),inset_0_-4px_7px_rgba(0,0,0,0.3)] transition hover:-translate-y-0.5 sm:hidden"
        >
          <span aria-hidden="true" className="pointer-events-none absolute left-[16%] top-[10%] h-[40%] w-[60%] rounded-full bg-white/25 blur-[3px]" />
          <PhoneIcon className="relative h-7 w-7" />
        </a>

        <a
          href={waLink(site.whatsapp, `Hello ${site.name}, I would like to enquire about a property.`)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Chat with us on WhatsApp"
          className="group relative flex items-center gap-2.5 overflow-hidden rounded-full bg-gradient-to-b from-[#5eeb97] via-[#25D366] to-[#189950] py-3.5 pl-3.5 pr-3.5 text-white shadow-[0_10px_30px_-8px_rgba(37,211,102,0.8),inset_0_1px_1px_rgba(255,255,255,0.6),inset_0_-4px_7px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-0.5 sm:pr-6"
        >
          <span aria-hidden="true" className="pointer-events-none absolute left-[10%] top-[12%] h-[38%] w-[32%] rounded-full bg-white/45 blur-[3px]" />
          <WhatsAppIcon className="relative h-8 w-8" />
          <span className={`relative hidden text-base font-semibold sm:inline ${nudge ? '' : 'opacity-0'} transition-opacity`}>
            Chat on WhatsApp
          </span>
        </a>
      </div>
    </>
  );
}

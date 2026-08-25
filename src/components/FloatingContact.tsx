'use client';

import { useEffect, useState } from 'react';
import { site, waLink } from '@/lib/constants';
import { WhatsAppIcon, PhoneIcon } from './SocialIcons';

/**
 * Sticky contact buttons. Most visitors arrive on a phone, so the two things they
 * are most likely to want — a WhatsApp message and a call — stay within thumb reach.
 */
export default function FloatingContact() {
  const [nudge, setNudge] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setNudge(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3 print:hidden">
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
  );
}

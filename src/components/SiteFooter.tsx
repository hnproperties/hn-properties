import Link from 'next/link';
import Image from 'next/image';
import { site, waLink } from '@/lib/constants';
import { WhatsAppIcon, InstagramIcon, PhoneIcon } from './SocialIcons';
import SoundToggle from './SoundToggle';

export default function SiteFooter() {
  return (
    <footer className="mt-4 border-t bg-[var(--navy)] text-white/80">
      <div className="wrap grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white">
              <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
            </span>
            <span className="display text-xl text-white">HN PROPERTIES</span>
          </div>
          <p className="mt-3 text-base text-white/70">
            Property consultancy in {site.city} — residential, commercial and land, for sale and on rent.
          </p>
          <p className="mt-3 text-base text-white/70">Founder: Harshit Narang</p>

          <div className="mt-5 flex gap-2">
            <a
              href={waLink(site.whatsapp, `Hello ${site.name},`)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-[#25D366] hover:text-white"
            >
              <WhatsAppIcon />
            </a>
            {site.instagram && (
              <a
                href={site.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-[#d6249f] hover:text-white"
              >
                <InstagramIcon />
              </a>
            )}
            <a
              href={`tel:${site.phone}`}
              aria-label="Call us"
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 transition hover:bg-[var(--brand)] hover:text-white"
            >
              <PhoneIcon />
            </a>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Browse</p>
          <ul className="mt-3 space-y-2.5 text-base">
            <li><Link href="/buy" className="hover:text-white">Property for sale</Link></li>
            <li><Link href="/rent" className="hover:text-white">Property on rent</Link></li>
            <li><Link href="/buy?segment=COMMERCIAL" className="hover:text-white">Commercial property</Link></li>
            <li><Link href="/buy?segment=LAND" className="hover:text-white">Land and plots</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Owners &amp; buyers</p>
          <ul className="mt-3 space-y-2.5 text-base">
            <li><Link href="/sell" className="hover:text-white">Sell your property</Link></li>
            <li><Link href="/give-on-rent" className="hover:text-white">Give on rent</Link></li>
            <li><Link href="/wanted" className="hover:text-white">Property wanted</Link></li>
            <li><Link href="/requirement" className="hover:text-white">Submit a requirement</Link></li>
            <li><Link href="/about" className="hover:text-white">About us</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Contact</p>
          <ul className="mt-3 space-y-2.5 text-base">
            <li><a href={`tel:${site.phone}`} className="hover:text-white">📞 {site.phone}</a></li>
            <li><a href={waLink(site.whatsapp, 'Hello HN Properties,')} className="hover:text-white">💬 WhatsApp {site.whatsapp}</a></li>
            {site.instagram && (
              <li>
                <a href={site.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  📷 Follow us on Instagram
                </a>
              </li>
            )}
            {site.email && <li><a href={`mailto:${site.email}`} className="hover:text-white">✉️ {site.email}</a></li>}
            <li className="text-white/60">📍 {site.address}</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="wrap flex flex-col gap-3 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} HN Properties. All rights reserved.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/disclaimer" className="hover:text-white">Disclaimer</Link>
            <Link href="/login" className="hover:text-white">Team login</Link>
            <Link href="/partner/login" className="hover:text-white">Partner login</Link>
            <SoundToggle subtleClicks className="text-white/60 hover:text-white" label="Sound" />
          </div>
        </div>
      </div>
    </footer>
  );
}

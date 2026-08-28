import type { Metadata } from 'next';
import Link from 'next/link';
import PartnerSignOut from '@/components/PartnerSignOut';

export const metadata: Metadata = {
  title: { default: 'Partner portal', template: '%s — HN Properties partners' },
  robots: { index: false, follow: false },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-[var(--plate)]">
        <div className="wrap flex h-16 items-center justify-between">
          <div>
            <Link href="/partner" className="display text-lg">HN Properties</Link>
            <p className="eyebrow">Partner portal</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-ghost">Website</Link>
            <PartnerSignOut />
          </div>
        </div>
      </header>
      <main className="wrap py-8">{children}</main>
    </div>
  );
}

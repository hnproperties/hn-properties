import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import FloatingContact from '@/components/FloatingContact';
import LiveRefresh from '@/components/LiveRefresh';
import PwaSetup from '@/components/PwaSetup';

/*
 * The marketplace manifest is linked here rather than through Next's app/manifest
 * convention. That convention injects its link into *every* page in the app,
 * including /crm — which then had two manifest links, and a browser uses the first
 * one it finds. That is why installing from the CRM handed out the marketplace app.
 * Declaring each manifest on the layout that owns it keeps the two apart.
 */
export const metadata: Metadata = {
  manifest: '/manifest.webmanifest',
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <FloatingContact />
      <LiveRefresh />
      <PwaSetup />
    </div>
  );
}

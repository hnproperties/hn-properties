import type { Metadata } from 'next';
import CrmShell from '@/components/crm/CrmShell';
import PwaSetup from '@/components/PwaSetup';

export const metadata: Metadata = {
  title: { default: 'CRM', template: '%s — HN Properties CRM' },
  robots: { index: false, follow: false },
  // Its own manifest, so installing the CRM gives staff a separate icon that
  // opens straight onto the desk instead of the public homepage.
  manifest: '/crm.webmanifest',
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <CrmShell>
      {children}
      {/*
        Registers the worker so the CRM is installable. The worker itself never
        caches anything under /crm — see public/sw.js. Staff get the home screen
        icon and the app window; the data still comes from the network every time.
      */}
      <PwaSetup />
    </CrmShell>
  );
}

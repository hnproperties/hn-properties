import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';
import LoginShell from '@/components/LoginShell';
import { site } from '@/lib/constants';

export const metadata: Metadata = { title: 'Team login', robots: { index: false, follow: false } };

export default function LoginPage() {
  return (
    <LoginShell
      eyebrow="Internal CRM"
      title="Sign in to the desk"
      intro="Properties, owners, clients, leads, visits and deals — all in one place."
      points={[
        'Inventory with private and public views',
        'Leads from the website, assigned automatically',
        'Requirement matching against live stock',
        'Follow-ups, site visits and deals in one place',
      ]}
      footer={
        <>
          Partner consultants sign in at <Link href="/partner/login" className="link-underline">the partner portal</Link>.
          Trouble signing in? Call {site.phone}.
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
        <LoginForm redirectTo="/crm" />
      </Suspense>
    </LoginShell>
  );
}

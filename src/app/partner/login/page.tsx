import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import LoginForm from '@/components/LoginForm';
import LoginShell from '@/components/LoginShell';

export const metadata: Metadata = { title: 'Partner login', robots: { index: false, follow: false } };

export default function PartnerLoginPage() {
  return (
    <LoginShell
      eyebrow="Partner portal"
      title="Consultant sign in"
      intro="Shared inventory and collaboration requests for approved partner firms."
      points={[
        'Search inventory shared with your firm',
        'Send a client brief without sharing their details',
        'Track every collaboration request',
        'Owner details always stay with HN Properties',
      ]}
      footer={
        <>
          Access is for approved consultant firms. Interested in working with us?{' '}
          <Link href="/contact" className="link-underline">Get in touch</Link>.
        </>
      }
    >
      <Suspense fallback={<p className="text-sm text-[var(--muted)]">Loading…</p>}>
        <LoginForm redirectTo="/partner" />
      </Suspense>
    </LoginShell>
  );
}

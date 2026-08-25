import type { Metadata } from 'next';
import { site } from '@/lib/constants';

export const metadata: Metadata = { title: 'Privacy policy', alternates: { canonical: '/privacy' } };

export default function PrivacyPage() {
  return (
    <div className="wrap max-w-3xl py-14">
      <h1 className="display text-3xl">Privacy policy</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated {new Date().getFullYear()}</p>

      <div className="mt-8 space-y-6 leading-relaxed text-[var(--ink-soft)]">
        <section>
          <h2 className="display text-xl text-[var(--ink)]">What we collect</h2>
          <p className="mt-2">
            When you submit an enquiry, a requirement, a site-visit request or a property, we collect
            the name, phone number, email address and details you enter. We also record basic
            technical information such as an anonymised record of the network address a submission
            came from, which we use to prevent spam.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">How we use it</h2>
          <p className="mt-2">
            We use your details to respond to your enquiry, match you against available property,
            arrange visits and complete transactions. We do not sell your data. We do not share
            owner contact details publicly, and we do not publish an owner&apos;s name or number on
            a listing.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Who can see it</h2>
          <p className="mt-2">
            Access is restricted by role within our own team, and every view of a contact record is
            logged. Partner consultants we collaborate with see only the property information we
            have explicitly shared with them — never client or owner contact details.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">How long we keep it</h2>
          <p className="mt-2">
            We keep enquiry and client records for as long as we are working with you, and for a
            reasonable period afterwards for accounting and legal purposes.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Your choices</h2>
          <p className="mt-2">
            You can ask us what we hold about you, ask for a correction, or ask us to delete your
            details. Call {site.phone} or write to us and we will act on it.
          </p>
        </section>

        <p className="text-sm">
          This policy describes our current practice. If you need formal confirmation of compliance
          with a specific regulation, please ask and we will provide it in writing.
        </p>
      </div>
    </div>
  );
}

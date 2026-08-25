import type { Metadata } from 'next';
import { site } from '@/lib/constants';

export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } };

export default function TermsPage() {
  return (
    <div className="wrap max-w-3xl py-14">
      <h1 className="display text-3xl">Terms of use</h1>

      <div className="mt-8 space-y-6 leading-relaxed text-[var(--ink-soft)]">
        <p>
          This website is operated by {site.name}, a property consultancy in {site.city}, Madhya Pradesh.
          By using it you agree to the terms below.
        </p>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Listings</h2>
          <p className="mt-2">
            Property details are provided by owners and verified by us to the extent described on the
            site. Prices, availability and specifications can change without notice. Nothing on this
            website is an offer or a contract.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Our role</h2>
          <p className="mt-2">
            We act as a consultant and intermediary between owners and buyers or tenants. We are not
            a party to the transaction itself. Professional fees are agreed separately in writing
            before a transaction completes.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Your use of the site</h2>
          <p className="mt-2">
            Do not scrape, copy or republish our listings, photographs or descriptions without written
            permission. Do not submit false enquiries or use the contact forms for marketing.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Governing law</h2>
          <p className="mt-2">
            These terms are governed by Indian law, and disputes fall under the jurisdiction of the
            courts at Jabalpur, Madhya Pradesh.
          </p>
        </section>
      </div>
    </div>
  );
}

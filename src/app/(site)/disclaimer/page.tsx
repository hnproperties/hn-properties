import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Disclaimer', alternates: { canonical: '/disclaimer' } };

export default function DisclaimerPage() {
  return (
    <div className="wrap max-w-3xl py-14">
      <h1 className="display text-3xl">Disclaimer</h1>

      <div className="mt-8 space-y-6 leading-relaxed text-[var(--ink-soft)]">
        <p>
          Information on this website is provided in good faith and is believed to be correct at the
          time of publication. It should not be relied on as a substitute for your own inspection,
          legal due diligence and professional advice.
        </p>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">HN Verified</h2>
          <p className="mt-2">
            Our HN Verified mark means our team has met the owner, visited the property, seen the
            ownership documents produced to us and confirmed that the property was available at the
            time of listing. It is an internal check, not a legal certification, and it is not a
            guarantee of clear title. Always have your advocate examine the documents before you pay
            any money.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Measurements, prices and maps</h2>
          <p className="mt-2">
            Areas and dimensions are approximate and taken from owner-provided documents. Prices are
            indicative and subject to negotiation. Map positions on listing pages show an approximate
            locality, not the exact plot.
          </p>
        </section>

        <section>
          <h2 className="display text-xl text-[var(--ink)]">Photographs</h2>
          <p className="mt-2">
            Photographs show the property at the time they were taken. Furnishing and fittings may
            not be included in the sale or rental unless stated in writing.
          </p>
        </section>
      </div>
    </div>
  );
}

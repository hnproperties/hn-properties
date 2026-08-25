import type { Metadata } from 'next';
import PublicForm from '@/components/PublicForm';
import { site, waLink } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Contact HN Properties',
  description: `Call, WhatsApp or write to ${site.name} in ${site.city}.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="eyebrow">Contact</p>
        <h1 className="display mt-2 text-3xl">Talk to us</h1>
        <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">
          The quickest route is a phone call. If you are sending a requirement or property details,
          WhatsApp works well — you can attach photographs.
        </p>

        <dl className="mt-8 space-y-4 text-sm">
          <div>
            <dt className="eyebrow">Phone</dt>
            <dd className="mt-1 text-lg"><a href={`tel:${site.phone}`} className="link-underline">{site.phone}</a></dd>
          </div>
          <div>
            <dt className="eyebrow">WhatsApp</dt>
            <dd className="mt-1">
              <a href={waLink(site.whatsapp, 'Hello HN Properties,')} className="link-underline" target="_blank" rel="noopener noreferrer">
                Message us on WhatsApp
              </a>
            </dd>
          </div>
          {site.email && (
            <div>
              <dt className="eyebrow">Email</dt>
              <dd className="mt-1"><a href={`mailto:${site.email}`} className="link-underline">{site.email}</a></dd>
            </div>
          )}
          {site.instagram && (
            <div>
              <dt className="eyebrow">Instagram</dt>
              <dd className="mt-1">
                <a href={site.instagram} target="_blank" rel="noopener noreferrer" className="link-underline">
                  @hnpropertiesjbp
                </a>
              </dd>
            </div>
          )}
          <div>
            <dt className="eyebrow">Office</dt>
            <dd className="mt-1 text-[var(--ink-soft)]">{site.address}</dd>
          </div>
        </dl>
      </div>

      <div>
        <PublicForm
          endpoint="/api/public/contact"
          submitLabel="Send message"
          successTitle="Message sent"
          successBody="We will get back to you shortly."
          fields={[
            { name: 'name', label: 'Your name', required: true, half: true },
            { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
            { name: 'email', label: 'Email (optional)', type: 'email', half: true },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
          ]}
        />
      </div>
    </div>
  );
}

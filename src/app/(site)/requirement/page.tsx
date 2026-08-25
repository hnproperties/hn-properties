import type { Metadata } from 'next';
import PublicForm from '@/components/PublicForm';
import { getPublicIndexes } from '@/lib/public-data';
import { site, OWNER_PROPERTY_TYPES, FIELD_TYPES } from '@/lib/constants';

export const metadata: Metadata = {
  title: 'Submit your property requirement',
  description: `Tell ${site.name} what you are looking for in ${site.city} and we will search our inventory and our network.`,
  alternates: { canonical: '/requirement' },
};

export default async function RequirementPage() {
  const { locations } = await getPublicIndexes();

  return (
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <p className="eyebrow">Buyers and tenants</p>
        <h1 className="display mt-2 text-3xl">Tell us what you need</h1>
        <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">
          A good part of what we handle never reaches the website — owners who prefer a quiet
          sale, properties still being prepared, and stock held by consultants we work with.
          Give us the requirement and we will match it against everything we have.
        </p>
        <p className="mt-4 leading-relaxed text-[var(--ink-soft)]">
          Be specific about locality and budget. It is the difference between a shortlist of
          four properties worth seeing and twenty that waste your Sunday.
        </p>
      </div>

      <div>
        <PublicForm
          endpoint="/api/public/requirements"
          submitLabel="Submit requirement"
          successTitle="Requirement received"
          successBody="We will match it against our inventory and call you with a shortlist."
          fields={[
            { name: 'name', label: 'Your name', required: true, half: true },
            { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
            {
              name: 'listingType', label: 'I want to', type: 'select', required: true, half: true,
              options: [{ value: 'SALE', label: 'Buy' }, { value: 'RENT', label: 'Rent' }],
            },
            { name: 'categorySlug', label: 'Property type', type: 'select', options: OWNER_PROPERTY_TYPES, half: true },
            { name: 'localities', label: 'Preferred areas', type: 'combobox', options: locations, placeholder: 'Start typing — e.g. Katanga', hint: 'Pick one, or type several separated by commas' },
            { name: 'budgetMin', label: 'Budget from', type: 'money', moneyUnit: '100000', half: true },
            { name: 'budgetMax', label: 'Budget up to', type: 'money', moneyUnit: '100000', half: true },
            { name: 'areaMin', label: 'Minimum area (sq.ft)', type: 'number', half: true },
            { name: 'bedroomsMin', label: 'Bedrooms', type: 'number', half: true, visibleFor: FIELD_TYPES.bedrooms },
            { name: 'purpose', label: 'Purpose', placeholder: 'Self use / investment / business', half: true },
            { name: 'timeline', label: 'Timeline', placeholder: 'e.g. within 3 months', half: true },
            { name: 'notes', label: 'Anything else', type: 'textarea' },
          ]}
        />
      </div>
    </div>
  );
}

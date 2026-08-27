import type { Metadata } from 'next';
import PublicForm from '@/components/PublicForm';
import { getPublicIndexes } from '@/lib/public-data';
import { site, toOptions, AREA_UNITS, FACINGS, FURNISHINGS, OWNER_PROPERTY_TYPES, FIELD_TYPES } from '@/lib/constants';

const AREA_UNIT_OPTIONS = toOptions(AREA_UNITS);
const FACING_OPTIONS = toOptions(FACINGS);
const FURNISHING_OPTIONS = toOptions(FURNISHINGS);


export const metadata: Metadata = {
  title: `Give your property on rent in ${site.city}`,
  description: `List your flat, house, shop, office or warehouse on rent with ${site.name}.`,
  alternates: { canonical: '/give-on-rent' },
};

/** Short points for phones, the fuller wording for laptops. */
const SHORT_POINTS = [
  'Verified tenants',
  'Market-based rent and deposit',
  'Managed property visits',
  'Agreement coordination',
  'Commercial lease support',
];

const FULL_POINTS = [
  'Tenant screening before the first viewing',
  'Rent, deposit and escalation set against current market rates',
  'Viewings arranged so you are not answering calls all day',
  'Agreement drafting coordinated with your advocate',
  'Commercial leasing: lock-in, maintenance and fit-out terms handled',
];

export default async function GiveOnRentPage() {
  const { locations } = await getPublicIndexes();

  return (
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[0.85fr_1.15fr]">
      <div>
        <p className="eyebrow">Owners</p>
        <h1 className="display mt-2 text-3xl">Give your property on rent</h1>
        <p className="mt-3 text-[var(--ink-soft)] lg:hidden">
          Find reliable tenants with a smooth, hassle-free rental process.
        </p>
        <p className="mt-4 hidden leading-relaxed text-[var(--ink-soft)] lg:block">
          We find tenants who can actually pay, screen them before they see the property,
          and put a proper agreement in place. For commercial space we also handle deposit,
          lock-in and escalation terms.
        </p>

        <ul className="mt-6 space-y-2.5 text-sm lg:mt-8 lg:space-y-4">
          {SHORT_POINTS.map((point, index) => (
            <li key={point} className="flex gap-3">
              <span className="text-[var(--brass)]">—</span>
              <span className="text-[var(--ink-soft)] lg:hidden">{point}</span>
              <span className="hidden text-[var(--ink-soft)] lg:inline">{FULL_POINTS[index]}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <PublicForm
          endpoint="/api/public/submissions"
          hidden={{ intent: 'RENT_OUT' }}
          submitLabel="Submit property details"
          successTitle="Thank you — we have your property"
          successBody="Our team will call you to arrange a visit and agree the rent."
          fields={[
            { name: 'name', label: 'Your name', required: true, half: true, section: 'Your details — only name and mobile are required' },
            { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
            { name: 'whatsapp', label: 'WhatsApp (optional)', half: true },
            { name: 'email', label: 'Email (optional)', type: 'email', half: true },
            { name: 'preferredTime', label: 'Best time to call', placeholder: 'e.g. weekday evenings', half: true },

            { name: 'categorySlug', label: 'Property type', type: 'select', options: OWNER_PROPERTY_TYPES, required: true, half: true, section: 'The property' },
            { name: 'locality', label: 'Locality', type: 'combobox', options: locations, placeholder: 'Type or pick — e.g. Napier Town', half: true, hint: 'Start typing and we will suggest localities' },
            { name: 'landmark', label: 'Nearby landmark', half: true },
            { name: 'facing', label: 'Facing', type: 'select', options: FACING_OPTIONS, half: true },
            { name: 'addressLine', label: 'Full address (optional)', placeholder: 'House / plot number, street, colony', hint: 'Never shown on the website — it only helps our team find the property' },
            { name: 'mapLink', label: 'Property location (optional)', type: 'location' },

            { name: 'areaUnit', label: 'Area unit', type: 'select', options: AREA_UNIT_OPTIONS, half: true, section: 'Measurements', hint: 'Applies to all the figures below' },
            { name: 'areaSize', label: 'Plot area', type: 'number', half: true, visibleFor: FIELD_TYPES.plotArea },
            { name: 'builtUpArea', label: 'Built-up area', type: 'number', half: true, visibleFor: FIELD_TYPES.builtUpArea },
            { name: 'superBuiltArea', label: 'Super built-up area', type: 'number', half: true, visibleFor: FIELD_TYPES.superBuiltArea },
            { name: 'carpetArea', label: 'Carpet area', type: 'number', half: true, visibleFor: FIELD_TYPES.carpetArea },
            { name: 'constructionYear', label: 'Year built', type: 'number', half: true, visibleFor: FIELD_TYPES.constructionYear },

            { name: 'acRooms', label: 'AC rooms', type: 'number', half: true, section: 'Configuration', visibleFor: FIELD_TYPES.hotelRooms },
            { name: 'nonAcRooms', label: 'Non-AC rooms', type: 'number', half: true, visibleFor: FIELD_TYPES.hotelRooms },
            { name: 'banquetHalls', label: 'Banquet halls', type: 'number', half: true, visibleFor: FIELD_TYPES.hotelRooms },
            { name: 'banquetCapacity', label: 'Banquet seating capacity', type: 'number', half: true, visibleFor: FIELD_TYPES.hotelRooms },
            { name: 'hasRestaurant', label: 'Restaurant', type: 'checkbox', hint: 'On-site restaurant', half: true, visibleFor: FIELD_TYPES.hotelRooms },
            { name: 'hotelParking', label: 'Parking spaces', type: 'number', half: true, visibleFor: FIELD_TYPES.hotelRooms },
            { name: 'hotelNotes', label: 'Other facilities', type: 'textarea', placeholder: 'Lift, generator, kitchen, conference room, licences held — anything that matters.', visibleFor: FIELD_TYPES.hotelRooms },
            { name: 'bedrooms', label: 'Bedrooms', type: 'number', half: true, section: 'Configuration', visibleFor: FIELD_TYPES.bedrooms },
            { name: 'bathrooms', label: 'Bathrooms', type: 'number', half: true, visibleFor: FIELD_TYPES.bedrooms },
            { name: 'floorNumber', label: 'Floor number (optional)', type: 'number', half: true, visibleFor: FIELD_TYPES.floors },
            { name: 'totalFloors', label: 'Total floors (optional)', type: 'number', half: true, visibleFor: FIELD_TYPES.floors },
            { name: 'parkingCovered', label: 'Covered parking spaces', type: 'number', half: true, visibleFor: FIELD_TYPES.parking },
            { name: 'furnishing', label: 'Furnishing', type: 'select', options: FURNISHING_OPTIONS, half: true, visibleFor: FIELD_TYPES.furnishing },

            { name: 'photos', label: 'Add photographs', type: 'photos', section: 'Photographs' },

            { name: 'expectedPrice', label: 'Expected monthly rent', type: 'money', moneyUnit: '1000', half: true, section: 'Price and notes', hint: 'Enter the figure and pick the unit' },
            { name: 'isNegotiable', label: 'Negotiable', type: 'checkbox', hint: 'Price is negotiable', half: true },
            { name: 'description', label: 'Anything else we should know', type: 'textarea', placeholder: 'Condition, approvals, restrictions, why you are selling — whatever helps us represent it properly.' },
          ]}
        />
      </div>
    </div>
  );
}

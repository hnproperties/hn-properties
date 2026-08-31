import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentOwner } from '@/lib/owner-session';
import PublicForm from '@/components/PublicForm';
import { getPublicIndexes } from '@/lib/public-data';
import { site, toOptions, AREA_UNITS, FACINGS, FURNISHINGS, OWNER_PROPERTY_TYPES, FIELD_TYPES } from '@/lib/constants';

const AREA_UNIT_OPTIONS = toOptions(AREA_UNITS);
const FACING_OPTIONS = toOptions(FACINGS);
const FURNISHING_OPTIONS = toOptions(FURNISHINGS);

/** Short labels for phones, full ones for laptops — same four steps either way. */
const SHORT_STEPS = [
  ['Share', 'Property details.'],
  ['Visit', 'We inspect and value.'],
  ['List', 'We market it.'],
  ['Sell', 'We handle the deal.'],
];

const FULL_STEPS = [
  ['You share the details', 'The form below takes two minutes. Documents are not needed yet.'],
  ['We call and visit', 'We see the property, discuss pricing and check the ownership papers.'],
  ['We list and market it', 'Photographs, website listing, WhatsApp circulation and our buyer database.'],
  ['We handle the process', 'Site visits, negotiation, token, agreement and registration.'],
];


export const metadata: Metadata = {
  title: `Sell your property in ${site.city}`,
  description: `List your house, flat, plot, shop or land for sale with ${site.name}.`,
  alternates: { canonical: '/sell' },
};

export default async function SellPage() {
  /*
   * Signed in before submitting, on purpose.
   *
   * The account is what ties the property to a person. Doing it at submission time
   * means we know exactly whose listing it is, rather than trying to match an email
   * afterwards and hoping it was the same one they gave Google. It is also what
   * makes "Your Listed Properties" work the moment they submit.
   *
   * Only this page and its sibling are gated. Browsing stays open to everyone,
   * including search engines — a login wall over the listings would take the site
   * out of Google, which is where the buyers come from.
   */
  const owner = await currentOwner();
  if (!owner) redirect('/sign-in?next=/sell');

  const { locations } = await getPublicIndexes();

  return (
    <div className="wrap grid gap-12 py-12 lg:grid-cols-[0.85fr_1.15fr]">
      <div>
        <p className="eyebrow">Owners</p>
        <h1 className="display mt-2 text-3xl">Sell your property</h1>
        {/* Phones get the short version; the full copy returns from lg up, where
            there is a column of space beside the form to fill. */}
        <p className="mt-3 text-[var(--ink-soft)] lg:hidden">
          Tell us what you have. We&rsquo;ll find the right buyer.
        </p>
        <p className="mt-4 hidden leading-relaxed text-[var(--ink-soft)] lg:block">
          Tell us what you have. We will look at recent transactions in your locality, give you
          an honest asking range, photograph the property properly, and bring you buyers who
          have already been qualified.
        </p>

        {/*
          Hidden on a phone. The form is now stepped, and its own progress bar says
          where you are — a second list of steps above it was answering a question
          the form already answers, while pushing the first field below the fold.
          The laptop keeps it, where there is room beside the form.
        */}
        <ol className="mt-6 hidden space-y-3 lg:mt-8 lg:block lg:space-y-5">
          {(SHORT_STEPS as [string, string][]).map(([title, body], index) => (
            <li key={title} className="flex gap-4">
              <span className="mono mt-0.5 text-sm text-[var(--brass)]">{String(index + 1).padStart(2, '0')}</span>
              <div>
                <p className="font-medium lg:hidden">{title}</p>
                <p className="hidden font-medium lg:block">{FULL_STEPS[index][0]}</p>
                <p className="text-sm text-[var(--muted)] lg:hidden">{body}</p>
                <p className="hidden text-sm text-[var(--muted)] lg:block">{FULL_STEPS[index][1]}</p>
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs text-[var(--muted)] lg:mt-8">
          Your contact details stay with us. We never publish an owner&apos;s name or number on the website.
        </p>
      </div>

      <div>
        <PublicForm
          reviewBeforeSend
          stepOnMobile
          endpoint="/api/public/submissions"
          hidden={{ intent: 'SELL' }}
          submitLabel="Submit property details"
          successTitle="Thank you — we have your property"
          successBody="Our team will call you to arrange a visit. Nothing is published until you approve it."
          fields={[
            { name: 'name', label: 'Your name', required: true, half: true, section: 'Your details — only name and mobile are required' },
            { name: 'phone', label: 'Mobile', type: 'tel', required: true, half: true },
            { name: 'whatsapp', label: 'WhatsApp (optional)', half: true },
            { name: 'email', label: 'Email (optional)', type: 'email', half: true },
            { name: 'preferredTime', label: 'Best time to call', placeholder: 'e.g. weekday evenings', half: true },

            { name: 'categorySlug', label: 'Property type', type: 'select', options: OWNER_PROPERTY_TYPES, required: true, half: true, section: 'The property' },
            { name: 'locality', label: 'Locality', type: 'combobox', options: locations, placeholder: 'Type or pick — e.g. Napier Town', half: true, hint: 'Start typing to search. Not listed? Type it in anyway and we will add it.' },
            { name: 'landmark', label: 'Nearby landmark', half: true },
            { name: 'facing', label: 'Facing', type: 'select', options: FACING_OPTIONS, half: true },
            { name: 'addressLine', label: 'Full address (optional)', placeholder: 'House / plot number, street, colony', section: 'Property location (optional)', hint: 'Never shown on the website — it only helps our team find the property' },
            { name: 'mapLink', label: 'Pin on the map (optional)', type: 'location' },

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

            { name: 'expectedPrice', label: 'Expected price', type: 'money', moneyUnit: '100000', half: true, section: 'Price and notes', hint: 'Enter the figure and pick Lakh or Crore' },
            { name: 'isNegotiable', label: 'Negotiable', type: 'checkbox', hint: 'Price is negotiable', half: true },
            { name: 'description', label: 'Anything else we should know', type: 'textarea', placeholder: 'Condition, approvals, restrictions, why you are selling — whatever helps us represent it properly.' },
          ]}
        />
      </div>
    </div>
  );
}

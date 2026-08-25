import { site, label, placeLine } from './constants';
import { inr, area } from './format';

type ListingLike = {
  publicId: string;
  slug: string;
  publicTitle: string;
  listingType: string;
  price?: number | string | null;
  property?: {
    bedrooms?: number | null;
    builtUpArea?: number | string | null;
    plotArea?: number | string | null;
    areaUnit?: string | null;
    location?: { name?: string } | null;
  } | null;
};

/** Share copy for WhatsApp. Never contains owner details. */
export function whatsappListingMessage(listing: ListingLike, lang: 'en' | 'hi' = 'en') {
  const size = listing.property?.builtUpArea ?? listing.property?.plotArea;
  const place = listing.property?.location?.name ?? site.city;
  const url = `${site.url}/property/${listing.publicId}`;

  if (lang === 'hi') {
    return [
      `*${site.name}*`,
      '',
      `🏠 *${listing.publicTitle}*`,
      `📍 ${placeLine(place)}`,
      size ? `📐 ${area(size, listing.property?.areaUnit ?? 'SQFT')}` : '',
      listing.price ? `💰 ${inr(listing.price)}${listing.listingType !== 'SALE' ? ' प्रति माह' : ''}` : '',
      `🔖 ${listing.publicId}`,
      '',
      `विस्तार से देखें: ${url}`,
      `📞 ${site.phone}`,
    ].filter(Boolean).join('\n');
  }

  return [
    `*${site.name}*`,
    '',
    `🏠 *${listing.publicTitle}*`,
    `📍 ${placeLine(place)}`,
    size ? `📐 ${area(size, listing.property?.areaUnit ?? 'SQFT')}` : '',
    listing.price ? `💰 ${inr(listing.price)}${listing.listingType !== 'SALE' ? ' per month' : ''} — ${label(listing.listingType)}` : '',
    `🔖 ${listing.publicId}`,
    '',
    `Details: ${url}`,
    `📞 ${site.phone}`,
  ].filter(Boolean).join('\n');
}

export function socialCaption(listing: ListingLike) {
  const place = listing.property?.location?.name ?? site.city;
  return [
    `${listing.publicTitle} in ${placeLine(place)}.`,
    listing.price ? `${inr(listing.price)}${listing.listingType === 'SALE' ? '' : ' per month'}.` : '',
    `Reference ${listing.publicId}. Call ${site.phone} to arrange a visit.`,
    '',
    `#Jabalpur #JabalpurProperty #${listing.listingType === 'SALE' ? 'PropertyForSale' : 'PropertyOnRent'} #HNProperties`,
  ].filter(Boolean).join(' ');
}

/**
 * Outbound notifications. Vendor-free by default: the console driver keeps the app
 * working before Resend / the WhatsApp Business API are connected.
 */
export async function sendEmail(input: { to: string; subject: string; body: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.info('[email:noop]', input.to, input.subject);
    return { delivered: false };
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'HN Properties <noreply@example.com>',
      to: input.to,
      subject: input.subject,
      text: input.body,
    }),
  });
  return { delivered: response.ok };
}

export async function sendWhatsApp(input: { to: string; body: string }) {
  console.info('[whatsapp:noop]', input.to);
  return { delivered: false };
}

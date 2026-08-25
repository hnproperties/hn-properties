import { cache as reactCache } from 'react';
import { prisma } from './prisma';

/**
 * React's cache() only exists inside the Next.js server runtime. The seed script
 * and any other plain Node script import this module too, so fall back to the
 * uncached function rather than crashing on import.
 */
const cache: <T>(fn: T) => T =
  typeof reactCache === 'function' ? (reactCache as any) : (fn) => fn;

export const SETTING_DEFAULTS: Record<string, unknown> = {
  'company.name': 'HN Properties',
  'company.tagline': 'Property consultancy in Jabalpur',
  'company.phone': '9713041004',
  'company.whatsapp': '9713041004',
  'company.email': '',
  'company.address': 'Jabalpur, Madhya Pradesh',
  'commission.default.sale': 2,
  'commission.default.rent': 100, // percent of one month's rent
  // 0 means a listing stays on the website until someone takes it down.
  'listing.default.expiryDays': 0,
  'listing.recheckDays': 21,
  'match.weight.budget': 35,
  'match.weight.location': 25,
  'match.weight.area': 20,
  'match.weight.config': 20,
  'match.budgetHeadroomPct': 10,
  'verify.criteria': [
    'Owner identity seen',
    'Property visited by our team',
    'Ownership documents received',
    'Photos taken by us',
    'Availability confirmed with the owner',
  ],
  'seo.titleSuffix': 'HN Properties, Jabalpur',
};

export const getSettings = cache(async (): Promise<Record<string, any>> => {
  try {
    const rows = await prisma.setting.findMany();
    const out: Record<string, any> = { ...SETTING_DEFAULTS };
    for (const row of rows) out[row.key] = row.value;
    return out;
  } catch {
    return { ...SETTING_DEFAULTS };
  }
});

export async function getSetting<T = any>(key: string, fallback?: T): Promise<T> {
  const settings = await getSettings();
  return (settings[key] ?? fallback ?? SETTING_DEFAULTS[key]) as T;
}

export async function setSetting(key: string, value: unknown, group = 'general') {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value: value as any, group },
    update: { value: value as any },
  });
}

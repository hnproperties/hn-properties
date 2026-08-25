/**
 * Imports Jabalpur places from OpenStreetMap into the Location table, so the map
 * picker can search landmarks — schools, hospitals, malls, temples, markets — and
 * not only the curated locality list.
 *
 *   npm run import-places
 *
 * Why OpenStreetMap and not Google: Google's terms forbid copying Places data into
 * another database, and bulk-fetching it is billable. OpenStreetMap is open data
 * under the ODbL licence, which permits exactly this provided contributors are
 * credited — the map already carries that credit.
 *
 * Localities you have curated are left alone. Imported places are stored as
 * LANDMARK, a separate rung below AREA, so the locality dropdowns stay short and
 * deliberate while the map search sees everything.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OVERPASS = 'https://overpass-api.de/api/interpreter';

/**
 * Everything named inside roughly 25km of Jabalpur that a person might use as a
 * landmark. Kept to categories people actually say out loud — "opposite the
 * Medical College", "near Big Bazaar" — rather than every tagged object.
 */
const QUERY = `
[out:json][timeout:300];
(
  // Localities and settlements
  node(around:25000,23.1815,79.9864)[place~"^(suburb|neighbourhood|quarter|village|hamlet|town|city_block)$"][name];
  way(around:25000,23.1815,79.9864)[place~"^(suburb|neighbourhood|quarter|city_block)$"][name];
  way(around:25000,23.1815,79.9864)[landuse=residential][name];

  // Named buildings — apartments, societies, complexes, offices, shops
  node(around:25000,23.1815,79.9864)[building][name];
  way(around:25000,23.1815,79.9864)[building][name];
  relation(around:25000,23.1815,79.9864)[building][name];

  // Every named shop, however small
  node(around:25000,23.1815,79.9864)[shop][name];
  way(around:25000,23.1815,79.9864)[shop][name];

  // Offices and businesses
  node(around:25000,23.1815,79.9864)[office][name];
  way(around:25000,23.1815,79.9864)[office][name];

  // Places people navigate by
  node(around:25000,23.1815,79.9864)[amenity][name];
  way(around:25000,23.1815,79.9864)[amenity][name];
  node(around:25000,23.1815,79.9864)[tourism][name];
  way(around:25000,23.1815,79.9864)[tourism][name];
  node(around:25000,23.1815,79.9864)[leisure][name];
  way(around:25000,23.1815,79.9864)[leisure][name];
  node(around:25000,23.1815,79.9864)[healthcare][name];
  node(around:25000,23.1815,79.9864)[railway=station][name];
  node(around:25000,23.1815,79.9864)[aeroway=aerodrome][name];
  node(around:25000,23.1815,79.9864)[highway=bus_stop][name];
);
out center tags;
`;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

type Place = { name: string; latitude: number; longitude: number; slug: string; kind: string };

/** A short human label for what the place is — shown beside search results. */
function describe(tags: Record<string, string>): string {
  if (tags.place) return tags.place.replace(/_/g, ' ');
  if (tags['addr:housename'] || tags.building === 'apartments' || tags.building === 'residential') return 'building';
  if (tags.shop) return tags.shop === 'yes' ? 'shop' : tags.shop.replace(/_/g, ' ');
  if (tags.office) return tags.office === 'yes' ? 'office' : `${tags.office.replace(/_/g, ' ')} office`;
  if (tags.amenity) return tags.amenity.replace(/_/g, ' ');
  if (tags.tourism) return tags.tourism.replace(/_/g, ' ');
  if (tags.leisure) return tags.leisure.replace(/_/g, ' ');
  if (tags.healthcare) return tags.healthcare.replace(/_/g, ' ');
  if (tags.railway) return 'railway station';
  if (tags.aeroway) return 'airport';
  if (tags.highway === 'bus_stop') return 'bus stop';
  if (tags.building) return 'building';
  return 'place';
}

async function fetchPlaces(): Promise<Place[]> {
  console.log('Asking OpenStreetMap for places around Jabalpur…');

  const response = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(QUERY)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass replied ${response.status}. It rate-limits; wait a minute and try again.`);
  }

  const payload = (await response.json()) as { elements: any[] };
  const seen = new Set<string>();
  const places: Place[] = [];

  for (const element of payload.elements ?? []) {
    const tags = element.tags ?? {};
    const name: string | undefined = tags.name;
    if (!name || name.length < 3 || name.length > 90) continue;

    // Numbered plots and house numbers are noise, not landmarks.
    if (/^(plot|house|shop)?\s*no\.?\s*\d+$/i.test(name)) continue;

    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!latitude || !longitude) continue;

    const slug = slugify(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);

    places.push({ name: name.trim(), latitude, longitude, slug, kind: describe(tags) });
  }

  return places;
}

async function main() {
  const city = await prisma.location.findFirst({ where: { type: 'CITY' }, orderBy: { sortOrder: 'asc' } });
  if (!city) throw new Error('No city found — run the seed first.');

  const places = await fetchPlaces();
  console.log(`Found ${places.length} named places.`);

  const mix = places.reduce<Record<string, number>>((totals, place) => {
    totals[place.kind] = (totals[place.kind] ?? 0) + 1;
    return totals;
  }, {});
  const top = Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log('Mix:', top.map(([kind, count]) => `${kind} ${count}`).join(', '));

  // Never shadow a curated locality: those are the ones staff chose.
  const existing = await prisma.location.findMany({
    where: { type: { in: ['AREA', 'LOCALITY'] } },
    select: { slug: true },
  });
  const curated = new Set(existing.map((row) => row.slug));

  let added = 0;
  let updated = 0;

  for (const place of places) {
    if (curated.has(place.slug)) continue;

    const found = await prisma.location.findFirst({
      where: { parentId: city.id, slug: place.slug },
      select: { id: true },
    });

    if (found) {
      await prisma.location.update({
        where: { id: found.id },
        data: { latitude: place.latitude, longitude: place.longitude },
      });
      updated += 1;
      continue;
    }

    await prisma.location.create({
      data: {
        type: 'LANDMARK',
        name: place.name,
        slug: place.slug,
        parentId: city.id,
        latitude: place.latitude,
        longitude: place.longitude,
        sortOrder: 500,
      },
    });
    added += 1;
  }

  console.log(`Added ${added} landmarks, refreshed ${updated}.`);
  console.log('Curated localities were left untouched.');
}

main()
  .catch((error) => {
    console.error(error.message ?? error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

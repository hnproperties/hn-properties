/**
 * One-off backfill: every listing created before this fix has publicLocationId
 * left null, which means it matched no locality anywhere on the public site —
 * not the Buy/Rent locality filter, not the homepage "browse by locality" list,
 * not the locality counts. New and edited listings fix themselves automatically
 * from here on (see src/lib/resources.ts and src/app/api/public/submissions);
 * this just catches up everything already in the database.
 *
 * Dry run first — it prints exactly what it would change and changes nothing:
 *
 *     npx tsx scripts/backfill-public-location.ts
 *
 * Then apply it:
 *
 *     npx tsx scripts/backfill-public-location.ts --apply
 */
import { prisma } from '../src/lib/prisma';

async function main() {
  const apply = process.argv.includes('--apply');

  const listings = await prisma.listing.findMany({
    where: { publicLocationId: null },
    select: { id: true, publicId: true, publicTitle: true, property: { select: { locationId: true, location: { select: { name: true } } } } },
  });

  const fixable = listings.filter((l) => l.property.locationId);
  const unfixable = listings.filter((l) => !l.property.locationId);

  console.log(`${listings.length} listing(s) with no public locality.`);
  console.log(`${fixable.length} can be backfilled from their property's location.`);
  for (const l of fixable) {
    console.log(`  ${l.publicId}  "${l.publicTitle}"  →  ${l.property.location!.name}`);
  }
  if (unfixable.length) {
    console.log(`${unfixable.length} have no location on their property either, so nothing to backfill — these need a locality set by hand in the CRM:`);
    for (const l of unfixable) console.log(`  ${l.publicId}  "${l.publicTitle}"`);
  }

  if (!apply) {
    console.log('\nDry run only — re-run with --apply to actually update these.');
    return;
  }

  for (const l of fixable) {
    await prisma.listing.update({ where: { id: l.id }, data: { publicLocationId: l.property.locationId! } });
  }
  console.log(`\nUpdated ${fixable.length} listing(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

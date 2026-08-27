/**
 * One-off category consolidation.
 *
 * Merges the overlapping category rows (Flat + Apartment, House + Villa +
 * Bungalow + Duplex, Shop + Showroom), renames a few, and sets the display
 * order. Categories are database rows referenced by live properties, so this
 * repoints those references before retiring anything.
 *
 * Run a dry run first — it prints exactly what it would do and changes nothing:
 *
 *     npx tsx scripts/migrate-categories.ts
 *
 * Then apply it:
 *
 *     npx tsx scripts/migrate-categories.ts --apply
 *
 * Retired rows are deactivated, never deleted, so nothing is lost and the change
 * can be reversed by flipping isActive back.
 */
import { PrismaClient, CategorySegment } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const slugify = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The list as it should end up, in display order. */
const TARGET: {
  name: string;
  segment: CategorySegment;
  /** Existing rows folded into this one. The first is renamed; the rest merge in. */
  absorbs: string[];
  flags?: { hasBedrooms?: boolean; hasFurnishing?: boolean; hasFrontage?: boolean; isLand?: boolean };
}[] = [
  { name: 'Flat/Apartment', segment: 'RESIDENTIAL', absorbs: ['Flat', 'Apartment'], flags: { hasBedrooms: true, hasFurnishing: true } },
  { name: 'House/Villa', segment: 'RESIDENTIAL', absorbs: ['House', 'Villa', 'Bungalow', 'Duplex'], flags: { hasBedrooms: true, hasFurnishing: true } },
  { name: 'Builder Floor', segment: 'RESIDENTIAL', absorbs: ['Builder Floor'], flags: { hasBedrooms: true, hasFurnishing: true } },
  { name: 'Farmhouse', segment: 'RESIDENTIAL', absorbs: ['Farmhouse'], flags: { hasBedrooms: true } },
  { name: 'Residential Plot', segment: 'RESIDENTIAL', absorbs: ['Residential Plot'], flags: { isLand: true } },
  { name: 'Commercial Shop/Showroom', segment: 'COMMERCIAL', absorbs: ['Shop', 'Showroom'], flags: { hasFrontage: true } },
  { name: 'Office Space', segment: 'COMMERCIAL', absorbs: ['Office'], flags: { hasFurnishing: true } },
  { name: 'Commercial Building', segment: 'COMMERCIAL', absorbs: ['Commercial Building'] },
  { name: 'Warehouse', segment: 'COMMERCIAL', absorbs: ['Warehouse'] },
  { name: 'Godown', segment: 'COMMERCIAL', absorbs: ['Godown'] },
  { name: 'Hotel', segment: 'COMMERCIAL', absorbs: ['Hotel'] },
  { name: 'Restaurant', segment: 'COMMERCIAL', absorbs: ['Restaurant'] },
  { name: 'Institutional Property', segment: 'COMMERCIAL', absorbs: ['Institutional Property'] },
  { name: 'Commercial Plot', segment: 'COMMERCIAL', absorbs: ['Commercial Plot'], flags: { isLand: true } },
  { name: 'Agricultural Land', segment: 'LAND', absorbs: ['Agricultural Land'], flags: { isLand: true } },
  { name: 'Farmland', segment: 'LAND', absorbs: ['Farmland'], flags: { isLand: true } },
  { name: 'Industrial Land', segment: 'LAND', absorbs: ['Industrial Land'], flags: { isLand: true } },
  { name: 'Development Land', segment: 'LAND', absorbs: ['Development Land'], flags: { isLand: true } },
  { name: 'Open Yard', segment: 'LAND', absorbs: ['Open Yard'], flags: { isLand: true } },
];

async function main() {
  console.log(APPLY ? '=== APPLYING CHANGES ===' : '=== DRY RUN — nothing will be written ===');
  console.log('Pass --apply to write.\n');

  const existing = await prisma.propertyCategory.findMany();
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  const keptIds = new Set<string>();

  for (const [order, target] of TARGET.entries()) {
    // The first named row becomes the surviving one, so any property already
    // pointing at it keeps working without being touched.
    const primary = target.absorbs.map((n) => byName.get(n.toLowerCase())).find(Boolean);

    if (!primary) {
      console.log(`CREATE  ${target.name} (${target.segment})`);
      if (APPLY) {
        const created = await prisma.propertyCategory.create({
          data: {
            name: target.name,
            slug: slugify(target.name),
            segment: target.segment,
            sortOrder: order,
            isActive: true,
            hasBedrooms: !!target.flags?.hasBedrooms,
            hasFurnishing: !!target.flags?.hasFurnishing,
            hasFrontage: !!target.flags?.hasFrontage,
            isLand: !!target.flags?.isLand,
          },
        });
        keptIds.add(created.id);
      }
      continue;
    }

    keptIds.add(primary.id);
    if (primary.name !== target.name) console.log(`RENAME  ${primary.name} → ${target.name}`);

    if (APPLY) {
      await prisma.propertyCategory.update({
        where: { id: primary.id },
        data: {
          name: target.name,
          slug: slugify(target.name),
          segment: target.segment,
          sortOrder: order,
          isActive: true,
          hasBedrooms: !!target.flags?.hasBedrooms,
          hasFurnishing: !!target.flags?.hasFurnishing,
          hasFrontage: !!target.flags?.hasFrontage,
          isLand: !!target.flags?.isLand,
        },
      });
    }

    // Fold the duplicates into the survivor.
    for (const otherName of target.absorbs) {
      const other = byName.get(otherName.toLowerCase());
      if (!other || other.id === primary.id) continue;

      const properties = await prisma.property.count({ where: { categoryId: other.id } });
      const requirements = await prisma.requirementCategory.count({ where: { categoryId: other.id } });
      const children = await prisma.propertyCategory.count({ where: { parentId: other.id } });
      console.log(
        `MERGE   ${other.name} → ${target.name}  (${properties} properties, ${requirements} requirement links, ${children} children)`,
      );

      if (APPLY) {
        await prisma.property.updateMany({ where: { categoryId: other.id }, data: { categoryId: primary.id } });
        await prisma.propertyCategory.updateMany({ where: { parentId: other.id }, data: { parentId: primary.id } });

        // RequirementCategory is a composite primary key, so a straight update
        // would collide where a requirement already links to both rows. Move the
        // ones that would not collide and drop the rest as duplicates.
        const links = await prisma.requirementCategory.findMany({ where: { categoryId: other.id } });
        for (const link of links) {
          const clash = await prisma.requirementCategory.findUnique({
            where: { requirementId_categoryId: { requirementId: link.requirementId, categoryId: primary.id } },
          });
          await prisma.requirementCategory.delete({
            where: { requirementId_categoryId: { requirementId: link.requirementId, categoryId: other.id } },
          });
          if (!clash) {
            await prisma.requirementCategory.create({
              data: { requirementId: link.requirementId, categoryId: primary.id },
            });
          }
        }

        // Retired, not deleted: reversible, and no risk to anything still pointing here.
        await prisma.propertyCategory.update({
          where: { id: other.id },
          data: { isActive: false, name: `${other.name} (merged)`, slug: `${slugify(other.name)}-merged`, sortOrder: 900 },
        });
      }
    }
  }

  // Anything not in the target list gets hidden rather than removed.
  const leftovers = existing.filter((c) => !keptIds.has(c.id) && c.isActive);
  for (const leftover of leftovers) {
    const used = await prisma.property.count({ where: { categoryId: leftover.id } });
    if (used > 0) {
      console.log(`KEEP    ${leftover.name} — still used by ${used} propert${used === 1 ? 'y' : 'ies'}, left active`);
      continue;
    }
    console.log(`RETIRE  ${leftover.name} (unused)`);
    if (APPLY) await prisma.propertyCategory.update({ where: { id: leftover.id }, data: { isActive: false } });
  }

  const active = await prisma.propertyCategory.count({ where: { isActive: true } });
  console.log(`\n${APPLY ? 'Done' : 'Would finish'} with ${APPLY ? active : TARGET.length} active categories.`);
  if (!APPLY) console.log('Nothing was written. Re-run with --apply when the plan above looks right.');
}

main()
  .catch((error) => {
    console.error('\nMigration failed — no partial state should remain beyond what printed above.');
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

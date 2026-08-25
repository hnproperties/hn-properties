/**
 * One-off tidy-up: earlier versions stamped a 90-day expiry on every published
 * listing. Listings now stay until someone takes them down, so those dates are
 * cleared. Safe to run more than once.
 *
 *   npx tsx scripts/clear-expiry.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cleared = await prisma.listing.updateMany({
    where: { status: { in: ['PUBLISHED', 'COMING_SOON'] }, expiresAt: { not: null } },
    data: { expiresAt: null },
  });
  console.log(`Cleared the expiry date on ${cleared.count} live listing(s).`);

  const revived = await prisma.listing.updateMany({
    where: { status: 'EXPIRED' },
    data: { status: 'PUBLISHED', visibility: 'PUBLIC', expiresAt: null },
  });
  if (revived.count) console.log(`Put ${revived.count} previously expired listing(s) back on the website.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

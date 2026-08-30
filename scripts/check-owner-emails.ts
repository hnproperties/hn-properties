/**
 * Read-only. Reports how many existing owners could actually sign in with Google.
 *
 * Google sign-in identifies someone by email. Owners are keyed by phone, and their
 * email is optional — so an owner with no email on file cannot be matched to their
 * own properties by a Google login alone. This counts how big that gap is, so the
 * decision to launch with Google before SMS is made on numbers rather than a guess.
 *
 *   npx tsx scripts/check-owner-emails.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const owners = await prisma.owner.findMany({
    select: { email: true, _count: { select: { properties: true } } },
  });

  if (!owners.length) {
    console.log('\nNo owners on file yet — nothing to measure.\n');
    return;
  }

  const withEmail = owners.filter((o: { email: string | null }) => !!o.email?.trim());
  const withProps = owners.filter((o: { _count: { properties: number } }) => o._count.properties > 0);
  const reachable = owners.filter(
    (o: { email: string | null; _count: { properties: number } }) => !!o.email?.trim() && o._count.properties > 0,
  );

  const pct = (n: number) => `${Math.round((n / owners.length) * 100)}%`;

  console.log(`\n${owners.length} owners on file.`);
  console.log(`  with an email address:        ${withEmail.length}  (${pct(withEmail.length)})`);
  console.log(`  with at least one property:   ${withProps.length}  (${pct(withProps.length)})`);
  console.log(`  BOTH — could sign in today:   ${reachable.length}  (${pct(reachable.length)})`);

  const stranded = withProps.length - reachable.length;
  if (stranded > 0) {
    console.log(
      `\n${stranded} owner${stranded === 1 ? ' has' : 's have'} properties but no email, so Google sign-in alone`,
    );
    console.log('would not reach them. They need phone sign-in, or a way to claim their account.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

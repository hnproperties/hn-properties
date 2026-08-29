/**
 * Read-only report on stored property documents. Changes nothing.
 *
 * Answers one question: are there any documents in the system, and are they
 * sitting in public storage? Run it before deciding whether the private-store
 * migration is worth doing.
 *
 * Standalone on purpose — no package.json entry needed:
 *
 *   npx tsx scripts/check-documents.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const documents = await prisma.propertyDocument.findMany({
    select: {
      title: true,
      kind: true,
      storageKey: true,
      sizeBytes: true,
      createdAt: true,
      property: { select: { code: true, title: true } },
      uploadedBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!documents.length) {
    console.log('\nNo property documents have ever been uploaded.');
    console.log('Nothing is exposed, and there is nothing to migrate.\n');
    return;
  }

  // A key that is still a URL lives in the public store; a pathname is private.
  const legacy = documents.filter((d: { storageKey: string }) => d.storageKey.startsWith('http'));
  const priv = documents.length - legacy.length;

  console.log(`\n${documents.length} document${documents.length === 1 ? '' : 's'} stored.`);
  console.log(`  in PUBLIC storage (readable by anyone with the URL): ${legacy.length}`);
  console.log(`  in private storage:                                  ${priv}\n`);

  if (legacy.length) {
    console.log('Documents currently in public storage:\n');
    for (const doc of legacy) {
      const size = doc.sizeBytes ? `${(doc.sizeBytes / 1024).toFixed(0)} KB` : 'size unknown';
      const who = doc.uploadedBy?.name ?? 'unknown';
      const when = doc.createdAt.toISOString().slice(0, 10);
      console.log(`  ${doc.property.code}  ${doc.kind}  "${doc.title}"`);
      console.log(`      ${size} · uploaded by ${who} on ${when}`);
    }
    console.log('\nEach of these has a live public URL that needs no login to open.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

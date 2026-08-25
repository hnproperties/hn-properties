import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient | typeof prisma;

/** Atomic sequence. Two people adding a property at once cannot collide on a code. */
export async function nextSequence(key: string, tx: Tx = prisma): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}

const pad = (n: number, width = 6) => String(n).padStart(width, '0');

/** Internal property reference, e.g. HNP-JBP-000124. */
export async function nextPropertyCode(cityCode: string, tx: Tx = prisma) {
  const city = (cityCode || 'JBP').toUpperCase();
  return `HNP-${city}-${pad(await nextSequence(`property:${city}`, tx))}`;
}

/** Public listing id, e.g. HNP-S-JBP-000001. Sale and rent have separate series. */
export async function nextListingPublicId(listingType: string, cityCode: string, tx: Tx = prisma) {
  const city = (cityCode || 'JBP').toUpperCase();
  const letter = listingType === 'SALE' ? 'S' : listingType === 'LEASE' ? 'L' : 'R';
  return `HNP-${letter}-${city}-${pad(await nextSequence(`listing:${letter}:${city}`, tx))}`;
}

export async function nextCode(prefix: string, width = 4, tx: Tx = prisma) {
  return `${prefix}-${pad(await nextSequence(`code:${prefix}`, tx), width)}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90);
}

/** Slug that stays unique without a retry loop on the caller's side. */
export async function uniqueListingSlug(base: string, publicId: string, tx: Tx = prisma) {
  const stem = slugify(base) || 'property';
  const candidate = `${stem}-${publicId.toLowerCase()}`;
  const clash = await tx.listing.findUnique({ where: { slug: candidate }, select: { id: true } });
  return clash ? `${candidate}-${Date.now().toString(36)}` : candidate;
}

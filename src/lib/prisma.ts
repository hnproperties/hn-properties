import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'] });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Prisma Decimal/Date values are not serialisable across the server/client boundary. */
export function plain<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) =>
      typeof v === 'object' && v !== null && typeof (v as any).toNumber === 'function'
        ? (v as any).toNumber()
        : v,
    ),
  );
}

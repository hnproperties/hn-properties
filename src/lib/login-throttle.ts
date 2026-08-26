/**
 * Brute-force protection for the sign-in route.
 *
 * Every failed sign-in already writes an `auth.login.failed` row to AuditLog with
 * the attempted address in `summary` and a hashed IP in `ipHash`, so the throttle
 * counts those rows instead of introducing new columns. That means no migration,
 * and — unlike an in-memory counter — it holds across serverless instances and
 * restarts, which is the whole point on Vercel.
 *
 * Two independent limits:
 *   per address — stops someone grinding one known account
 *   per IP      — stops someone spraying one password across many accounts
 *
 * A successful sign-in clears that address's failures so a person who eventually
 * remembers their password is not left locked out by their own earlier typos.
 */
import { prisma } from './prisma';
import { hashIp } from './audit';

export const WINDOW_MINUTES = 15;
export const MAX_PER_EMAIL = 8;
export const MAX_PER_IP = 25;

const windowStart = () => new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

/**
 * True when this address or address-plus-IP has failed too often recently.
 * Callers must return the same generic error they use for a wrong password:
 * telling an attacker they have hit a limit confirms the account is real.
 */
export async function isThrottled(email: string, ip?: string | null): Promise<boolean> {
  const since = windowStart();
  const ipHash = hashIp(ip);

  const [byEmail, byIp] = await Promise.all([
    prisma.auditLog.count({
      where: { action: 'auth.login.failed', summary: email.toLowerCase(), createdAt: { gte: since } },
    }),
    ipHash
      ? prisma.auditLog.count({
          where: { action: 'auth.login.failed', ipHash, createdAt: { gte: since } },
        })
      : Promise.resolve(0),
  ]);

  return byEmail >= MAX_PER_EMAIL || byIp >= MAX_PER_IP;
}

/**
 * Clear an address's recent failures after a correct password. Deletes only
 * `auth.login.failed` rows for that address, leaving every other audit row —
 * including successful sign-ins and the blocked attempts — intact.
 */
export async function clearFailures(email: string): Promise<void> {
  try {
    await prisma.auditLog.deleteMany({
      where: {
        action: 'auth.login.failed',
        summary: email.toLowerCase(),
        createdAt: { gte: windowStart() },
      },
    });
  } catch (error) {
    // Never let audit cleanup block a legitimate sign-in.
    console.error('[login-throttle] failed to clear attempts', error);
  }
}

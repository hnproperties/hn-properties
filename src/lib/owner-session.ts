import 'server-only';
import { cookies } from 'next/headers';
import { prisma } from './prisma';
import { OWNER_COOKIE, readOwnerToken } from './owner-token';

/**
 * Server-side helpers for owner accounts.
 *
 * The token signing and verification live in owner-token.ts, which middleware also
 * imports — that file has to stay free of Prisma and `server-only` so it can run on
 * the edge. Everything here needs the database, so it stays on the server.
 *
 * Kept separate from lib/session.ts, and that separation is the security design
 * rather than tidiness. Staff sessions carry a role the whole CRM trusts; an owner
 * has no role and must never acquire one. Two systems that share nothing cannot
 * leak into one another through a mistake in a shared helper.
 */

export { OWNER_COOKIE, createOwnerToken, readOwnerToken, ownerCookieOptions } from './owner-token';
export type { OwnerSession } from './owner-token';

/**
 * The signed-in owner, re-read from the database on every call.
 *
 * The token is not trusted beyond identity. Whether the account is still active,
 * and which owner record it speaks for, are read fresh — so deactivating an account
 * takes effect on the next request rather than whenever the token expires.
 *
 * Middleware checks only that the token is valid, because it cannot reach the
 * database from the edge. This is the real check, and it still runs on every page
 * that matters.
 */
export async function currentOwner() {
  const token = cookies().get(OWNER_COOKIE)?.value;
  const session = await readOwnerToken(token);
  if (!session) return null;

  const account = await prisma.ownerAccount.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      email: true,
      name: true,
      photoUrl: true,
      phone: true,
      isActive: true,
      sessionEpoch: true,
      ownerId: true,
    },
  });

  if (!account || !account.isActive) return null;
  if (account.sessionEpoch !== session.epoch) return null;

  return account;
}

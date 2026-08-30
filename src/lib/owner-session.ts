import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from './prisma';

/**
 * Sessions for owner accounts on the public site.
 *
 * A separate file, a separate cookie and separate helpers from lib/session.ts, and
 * that separation is the security design rather than tidiness. Staff sessions carry
 * a role that the whole CRM trusts; an owner has no role and must never be able to
 * acquire one. Two systems that share nothing cannot leak into one another by way
 * of a mistake in a shared helper.
 *
 * Note what this cookie deliberately does not do: it has no `domain`, so it is
 * host-only. The staff cookie is scoped to .hnproperties.co.in so a login works
 * across the CRM subdomain; an owner's cookie has no business travelling to
 * crm.hnproperties.co.in, so it does not.
 */

export const OWNER_COOKIE = 'hn_owner';

const secret = () => {
  // AUTH_SECRET, matching lib/session.ts — the same secret the staff login already
  // uses, so there is one value to rotate rather than two that can drift apart.
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is not set');
  // Salted differently, so an owner token can never verify as a staff token even
  // though both are signed with the same underlying secret.
  return new TextEncoder().encode(`${value}::owner`);
};

const SESSION_DAYS = 30;

export type OwnerSession = {
  sub: string;
  email: string;
  name: string | null;
  epoch: number;
};

export async function createOwnerToken(session: OwnerSession) {
  return new SignJWT({ email: session.email, name: session.name, epoch: session.epoch })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());
}

export async function readOwnerToken(token?: string | null): Promise<OwnerSession | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.email !== 'string') return null;
    return {
      sub: payload.sub,
      email: payload.email,
      name: (payload.name as string | null) ?? null,
      epoch: Number(payload.epoch ?? 0),
    };
  } catch {
    return null;
  }
}

export function ownerCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
    // No domain: host-only, so this never reaches the CRM subdomain.
  };
}

/**
 * The signed-in owner, re-read from the database on every call.
 *
 * The token is not trusted for anything beyond identity. Whether the account is
 * still active, and which owner record it speaks for, are read fresh — so
 * deactivating an account or unlinking it takes effect on the next request rather
 * than whenever the token happens to expire.
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
  // Bumped when an account is deactivated or its access is withdrawn.
  if (account.sessionEpoch !== session.epoch) return null;

  return account;
}

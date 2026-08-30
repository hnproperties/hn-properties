import { SignJWT, jwtVerify } from 'jose';

/**
 * Owner token signing and verification, with no server-only imports.
 *
 * Split out from owner-session.ts so middleware can use it. Middleware runs on the
 * edge runtime, where Prisma and `server-only` cannot go — and this needs to run
 * there, because a redirect decided in middleware happens before any rendering,
 * while one decided inside a page happens after the shell has already been painted.
 * That difference is the flash of a half-drawn page on the way to sign-in.
 */

export const OWNER_COOKIE = 'hn_owner';

const SESSION_DAYS = 30;

const secret = () => {
  // AUTH_SECRET, shared with the staff session, salted differently so an owner
  // token can never verify as a staff one.
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(`${value}::owner`);
};

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

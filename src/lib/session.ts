/**
 * Edge-safe session helpers. Imported by middleware, so nothing here may pull in
 * bcrypt, Prisma or next/headers.
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'hn_session';

export type SessionPayload = {
  sub: string;
  name: string;
  email: string;
  role: string;
  consultantId?: string | null;
  epoch: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(value);
}

export function sessionHours() {
  const raw = Number(process.env.SESSION_HOURS ?? 12);
  return Number.isFinite(raw) && raw > 0 ? raw : 12;
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${sessionHours()}h`)
    .sign(secret());
}

export async function readSessionToken(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.role !== 'string') return null;
    return {
      sub: payload.sub,
      name: String(payload.name ?? ''),
      email: String(payload.email ?? ''),
      role: payload.role,
      consultantId: (payload.consultantId as string | null) ?? null,
      epoch: Number(payload.epoch ?? 0),
    };
  } catch {
    return null;
  }
}

/**
 * Where the session cookie is valid.
 *
 * Left unset, the cookie belongs to exactly the host that issued it, so a login on
 * hnproperties.co.in would not be sent to crm.hnproperties.co.in and staff would
 * land back on the sign-in form. Setting a leading-dot domain shares it across the
 * parent and every subdomain, which is what lets the CRM live on its own host while
 * still being one account.
 *
 * Driven by an environment variable rather than hard-coded, because it must stay
 * unset on localhost — browsers reject a domain cookie that does not match the host,
 * and the failure looks like "login silently does nothing", which is a miserable
 * thing to debug. Set COOKIE_DOMAIN=.hnproperties.co.in in production only.
 */
function cookieDomain() {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  return domain ? { domain } : {};
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionHours() * 60 * 60,
    ...cookieDomain(),
  };
}

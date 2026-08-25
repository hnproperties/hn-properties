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

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: sessionHours() * 60 * 60,
  };
}

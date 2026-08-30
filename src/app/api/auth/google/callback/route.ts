import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OAUTH_STATE_COOKIE, exchangeCode, googleConfigured, redirectUri } from '@/lib/google-oauth';
import { OWNER_COOKIE, createOwnerToken, ownerCookieOptions } from '@/lib/owner-session';

export const dynamic = 'force-dynamic';

const fail = (req: NextRequest, reason: string) =>
  NextResponse.redirect(new URL(`/sign-in?error=${reason}`, req.nextUrl.origin));

export async function GET(req: NextRequest) {
  if (!googleConfigured()) return fail(req, 'unavailable');

  const code = req.nextUrl.searchParams.get('code');
  const returnedState = req.nextUrl.searchParams.get('state');
  const stored = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  // The visitor pressed cancel on Google's screen. Not an error worth shouting about.
  if (req.nextUrl.searchParams.get('error')) return fail(req, 'cancelled');
  if (!code || !returnedState || !stored) return fail(req, 'state');

  const [expectedState, next = '/account'] = stored.split(':');
  // Constant-time-ish comparison is overkill for a value we generated seconds ago,
  // but the equality check itself is the whole CSRF defence — without it, someone
  // else's authorization code would be accepted as if it were the visitor's own.
  if (expectedState !== returnedState) return fail(req, 'state');

  const profile = await exchangeCode(code, redirectUri(req));
  if (!profile) return fail(req, 'exchange');

  /*
   * An unverified Google address is not proof of anything. Google normally only
   * issues these for Workspace accounts under unusual configurations, but treating
   * one as verified would let someone claim an owner record by asserting an email
   * they do not control.
   */
  if (!profile.emailVerified) return fail(req, 'unverified');

  /*
   * Link the account to the owner record that submitted the properties.
   *
   * Matched on email, which Google has just verified. This is the whole reason the
   * submission form now asks for one: without it there is nothing to match on, and
   * an owner signing in would see an empty page next to a listing that is plainly
   * theirs. Matching on a typed phone number instead would mean trusting an
   * unverified claim, which would expose one owner's details to anyone who guessed
   * their number.
   */
  const owner = await prisma.owner.findFirst({
    where: { email: { equals: profile.email, mode: 'insensitive' } },
    select: { id: true },
  });

  const account = await prisma.ownerAccount.upsert({
    where: { email: profile.email },
    create: {
      email: profile.email,
      name: profile.name,
      photoUrl: profile.picture,
      googleSub: profile.sub,
      ownerId: owner?.id ?? null,
      lastAuthMethod: 'GOOGLE',
      lastLoginAt: new Date(),
    },
    update: {
      googleSub: profile.sub,
      // The name and photo are only refreshed if the account has not set its own.
      name: profile.name ?? undefined,
      lastAuthMethod: 'GOOGLE',
      lastLoginAt: new Date(),
      // Never unlinks: an account already pointed at an owner keeps that link even
      // if the owner's email is later edited in the CRM.
      ...(owner && { ownerId: owner.id }),
    },
    select: { id: true, email: true, name: true, sessionEpoch: true, isActive: true },
  });

  if (!account.isActive) return fail(req, 'disabled');

  const token = await createOwnerToken({
    sub: account.id,
    email: account.email,
    name: account.name,
    epoch: account.sessionEpoch,
  });

  const response = NextResponse.redirect(new URL(next, req.nextUrl.origin));
  response.cookies.set(OWNER_COOKIE, token, ownerCookieOptions());
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}

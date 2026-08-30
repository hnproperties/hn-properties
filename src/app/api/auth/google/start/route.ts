import { type NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { OAUTH_STATE_COOKIE, googleAuthUrl, googleConfigured } from '@/lib/google-oauth';

export const dynamic = 'force-dynamic';

/**
 * Sends the visitor to Google.
 *
 * The `state` value is the CSRF defence. It is generated here, stored in a
 * short-lived cookie, and sent to Google; the callback only proceeds if what comes
 * back matches what was stored. Without it, an attacker could feed someone a
 * callback URL carrying their own authorization code and quietly sign the victim
 * into the attacker's account.
 *
 * `next` lets a visitor who was sent here from a page return to it afterwards. It
 * is deliberately restricted to a path on this site — an open redirect would let a
 * phishing link borrow our domain to bounce people somewhere else.
 */
export function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: 'Google sign-in is not configured' }, { status: 503 });
  }

  const state = crypto.randomBytes(24).toString('base64url');

  const requested = req.nextUrl.searchParams.get('next') ?? '/account';
  const next = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/account';

  const response = NextResponse.redirect(googleAuthUrl(req, state));
  response.cookies.set(OAUTH_STATE_COOKIE, `${state}:${next}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 10 * 60, // long enough to sign in, short enough not to linger
  });
  return response;
}

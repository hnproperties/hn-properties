import type { NextRequest } from 'next/server';

/**
 * Google OAuth, spoken directly rather than through a library.
 *
 * The authorization-code flow is three HTTP calls and a signature check, and a
 * general-purpose auth library would bring its own session model, its own database
 * tables and its own opinions about roles — all of which this project already has,
 * and none of which would agree with what is here.
 */

export const OAUTH_STATE_COOKIE = 'hn_oauth_state';

export const googleConfigured = () =>
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

/**
 * The redirect URI, derived from the request rather than a constant.
 *
 * It must match what is registered in the Google console *exactly*, and it differs
 * between localhost and production. Building it from the incoming host means the
 * same code works in both without a second environment variable to get wrong —
 * mismatched redirect URIs are the most common failure in this whole flow.
 */
export function redirectUri(req: NextRequest) {
  const host = req.headers.get('host') ?? 'hnproperties.co.in';
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}/api/auth/google/callback`;
}

export function googleAuthUrl(req: NextRequest, state: string) {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set('redirect_uri', redirectUri(req));
  url.searchParams.set('response_type', 'code');
  // Only what is needed to know who someone is. Anything broader would drag this
  // app into Google's verification review for no benefit.
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

export type GoogleProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

/**
 * Exchanges the one-time code for the user's identity.
 *
 * The profile is read from Google's userinfo endpoint over TLS rather than by
 * decoding the id_token here. Both are fine; this avoids hand-rolling JWKS key
 * rotation for a single call, and the response comes straight from Google.
 */
export async function exchangeCode(code: string, uri: string): Promise<GoogleProfile | null> {
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: uri,
      grant_type: 'authorization_code',
    }),
    cache: 'no-store',
  });

  if (!tokenResponse.ok) return null;
  const tokens = (await tokenResponse.json()) as { access_token?: string };
  if (!tokens.access_token) return null;

  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: 'no-store',
  });
  if (!profileResponse.ok) return null;

  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  if (!profile.sub || !profile.email) return null;

  return {
    sub: profile.sub,
    email: profile.email.toLowerCase(),
    emailVerified: profile.email_verified !== false,
    name: profile.name ?? null,
    picture: profile.picture ?? null,
  };
}

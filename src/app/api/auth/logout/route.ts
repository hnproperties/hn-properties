import { NextResponse } from 'next/server';
import { cookieOptions, SESSION_COOKIE } from '@/lib/auth';
import { route } from '@/lib/api';

export const POST = route(async () => {
  const response = NextResponse.json({ data: { ok: true } });
  /*
   * Cleared with the same options it was set with, domain included. A cookie is
   * identified by name, path *and* domain, so clearing it without the domain
   * removes a different cookie than the one that exists — leaving the real session
   * alive on the other host, which is the opposite of what signing out means.
   */
  response.cookies.set(SESSION_COOKIE, '', { ...cookieOptions(), maxAge: 0 });
  return response;
});

import { NextResponse } from 'next/server';
import { OWNER_COOKIE, ownerCookieOptions } from '@/lib/owner-session';

export const dynamic = 'force-dynamic';

/** Signs an owner out. Cleared with the same options it was set with, or it survives. */
export async function POST() {
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(OWNER_COOKIE, '', { ...ownerCookieOptions(), maxAge: 0 });
  return response;
}

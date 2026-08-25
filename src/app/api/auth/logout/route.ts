import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { route } from '@/lib/api';

export const POST = route(async () => {
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
});

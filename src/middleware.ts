import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSessionToken } from './lib/session';

/**
 * Edge gate. Runs before any handler, so an unauthenticated request never reaches
 * code that could touch private data. Fine-grained permission checks happen in the
 * handlers themselves — this only answers "are you signed in, and is this your area".
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith('/api');

  // Signed-in visitors are not bounced away from the login pages. A token can
  // outlive the user record it points at — after a database change, for instance —
  // and bouncing them to /crm, which then sends them back here, is an endless loop.
  // Showing the form lets them sign in again and replace the stale cookie.
  if (pathname === '/login' || pathname === '/partner/login') {
    return NextResponse.next();
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = pathname.startsWith('/partner') ? '/partner/login' : '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  // Partners never reach the internal CRM, and staff have no business in the partner portal.
  if (pathname.startsWith('/crm') && session.role === 'PARTNER') {
    return NextResponse.redirect(new URL('/partner', req.url));
  }
  if (pathname.startsWith('/partner') && session.role !== 'PARTNER') {
    return NextResponse.redirect(new URL('/crm', req.url));
  }

  /*
   * The redirect above only moves a partner away from a CRM *page*. It does not
   * stop them calling the API those pages use, and until now nothing else did:
   * the handlers check permissions, and a permission ticked onto the Partner
   * Consultant role — by accident or otherwise — was enough to read the owner or
   * client tables in full. Role is a stronger statement than any single grant, so
   * it is enforced here, ahead of the handler, and cannot be undone from Settings.
   *
   * Every internal API path in the matcher below is denied to a partner outright.
   * Their own routes (/api/partner/*), sign-in (/api/auth/*) and the public
   * endpoints are not matched at all, so they are unaffected.
   */
  if (isApi && session.role === 'PARTNER') {
    return NextResponse.json({ error: 'Not available for partner accounts' }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/crm/:path*',
    '/partner/:path*',
    '/login',
    '/api/properties/:path*',
    '/api/listings/:path*',
    '/api/owners/:path*',
    '/api/clients/:path*',
    '/api/requirements/:path*',
    '/api/leads/:path*',
    '/api/site-visits/:path*',
    '/api/deals/:path*',
    '/api/follow-ups/:path*',
    '/api/consultants/:path*',
    '/api/collaborations/:path*',
    '/api/documents/:path*',
    '/api/users/:path*',
    '/api/roles/:path*',
    '/api/settings/:path*',
    '/api/audit/:path*',
    '/api/dashboard/:path*',
    '/api/lookups/:path*',
    '/api/reports/:path*',
    // Internal too, and previously outside the matcher entirely — global search
    // reaches owners, clients and leads, and the CRM streams carry desk activity.
    '/api/search/:path*',
    '/api/uploads/:path*',
    '/api/locations/:path*',
    '/api/crm/:path*',
  ],
};

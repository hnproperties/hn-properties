import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSessionToken } from './lib/session';

/**
 * Edge gate. Runs before any handler, so an unauthenticated request never reaches
 * code that could touch private data. Fine-grained permission checks happen in the
 * handlers themselves — this only answers "are you signed in, and is this your area".
 */
/**
 * Paths served as-is on the CRM subdomain rather than being rewritten under /crm.
 *
 * The sign-in form is the important one: without it, an unauthenticated visit to
 * the subdomain would redirect to /login, which would be rewritten to /crm/login
 * and 404 — locking staff out of the very host they are trying to reach.
 */
/**
 * Everything that requires a session.
 *
 * This used to be the matcher's job. The matcher now has to be a catch-all, so
 * that a request to the CRM subdomain's root reaches this file at all — and with
 * a catch-all, a public listing page would be checked for a session and its
 * visitor redirected to sign in. So the list moves here and is checked explicitly:
 * anything not named below passes straight through, exactly as before.
 */
const PROTECTED = [
  '/crm',
  '/partner',
  '/api/properties', '/api/listings', '/api/owners', '/api/clients', '/api/requirements',
  '/api/leads', '/api/site-visits', '/api/deals', '/api/follow-ups', '/api/consultants',
  '/api/collaborations', '/api/documents', '/api/users', '/api/roles', '/api/settings',
  '/api/audit', '/api/dashboard', '/api/lookups', '/api/reports', '/api/search',
  '/api/uploads', '/api/locations', '/api/crm',
];

const SUBDOMAIN_PASSTHROUGH = ['/api', '/_next', '/login', '/partner', '/icon', '/apple-icon', '/favicon', '/sw.js', '/offline.html', '/.well-known'];

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const host = req.headers.get('host') ?? '';

  /*
   * The CRM has its own host so the two installable apps stop overlapping.
   *
   * Both used to live on one origin, with the marketplace app claiming scope "/"
   * — which contains /crm. Browsers treat that as one app inside another and
   * refuse to offer the inner one for installation once the outer is installed,
   * so "Download HN Core" answered "already installed" and opened the marketplace.
   * Nothing in a manifest fixes that; the apps have to be on separate origins.
   *
   * So crm.<domain>/x serves /crm/x. The CRM code is untouched and still lives at
   * /crm internally — only the address changes.
   */
  const isCrmHost = host.startsWith('crm.');

  /*
   * Once the subdomain is live, /crm on the main domain moves there.
   *
   * Without this the CRM would still answer inside the marketplace's scope, and the
   * nested-app problem would survive for anyone who reached it by the old address —
   * which is most people, since it is the link everyone already has. Skipped
   * entirely until CRM_HOST is set, so deploying this ahead of DNS changes nothing.
   */
  const crmHost = process.env.CRM_HOST?.trim();
  if (crmHost && !isCrmHost && (url.pathname === '/crm' || url.pathname.startsWith('/crm/'))) {
    const moved = new URL(url.toString());
    moved.host = crmHost;
    moved.pathname = url.pathname.replace(/^\/crm/, '') || '/';
    return NextResponse.redirect(moved, 308);
  }
  const alreadyPrefixed = url.pathname === '/crm' || url.pathname.startsWith('/crm/');
  if (
    isCrmHost &&
    !alreadyPrefixed && // the CRM's own links are absolute /crm/... — don't prefix them twice
    !SUBDOMAIN_PASSTHROUGH.some((prefix) => url.pathname.startsWith(prefix))
  ) {
    const rewritten = url.clone();
    rewritten.pathname = url.pathname === '/' ? '/crm' : `/crm${url.pathname}`;
    const response = NextResponse.rewrite(rewritten);
    // The desk is not for search engines, and this host should never be indexed.
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return applyGate(req, rewritten.pathname, response);
  }

  return applyGate(req, url.pathname, null);
}

/** The sign-in and role checks, run against the path the request will actually reach. */
async function applyGate(req: NextRequest, pathname: string, passthrough: NextResponse | null) {
  // Public pages, public API, static assets: nothing to check.
  if (!PROTECTED.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    if (pathname !== '/login' && pathname !== '/partner/login') return passthrough ?? NextResponse.next();
  }

  const session = await readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith('/api');

  // Signed-in visitors are not bounced away from the login pages. A token can
  // outlive the user record it points at — after a database change, for instance —
  // and bouncing them to /crm, which then sends them back here, is an endless loop.
  // Showing the form lets them sign in again and replace the stale cookie.
  if (pathname === '/login' || pathname === '/partner/login') {
    return passthrough ?? NextResponse.next();
  }

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    const target = req.nextUrl.clone();
    target.pathname = pathname.startsWith('/partner') ? '/partner/login' : '/login';
    target.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(target);
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

  return passthrough ?? NextResponse.next();
}

export const config = {
  /*
   * A catch-all, because the CRM subdomain's root path has to reach this file to be
   * rewritten, and a path list cannot express "any path, but only on that host".
   * Static assets and image optimiser requests are excluded — they are served
   * before any of this matters and would only add latency. The PROTECTED list above
   * is what decides whether a request is actually gated.
   */
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|avif|ico|txt|xml|webmanifest)$).*)'],
};

import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * The HN Core manifest, built per host.
 *
 * The CRM answers on two addresses — hnproperties.co.in/crm and, once DNS is
 * pointed, crm.hnproperties.co.in — and a manifest's start_url and scope are
 * relative to the host serving it. A single static file cannot be right for both:
 * scope "/crm" on the subdomain would point at crm.hnproperties.co.in/crm, which
 * does not exist there, and the app would open on a 404.
 *
 * So the values are decided from the request. On the subdomain the CRM *is* the
 * whole site, so scope is "/". On the main domain it stays under "/crm".
 *
 * The subdomain is the point of the exercise: two apps on one origin, with the
 * marketplace claiming scope "/", are treated by browsers as one app nested inside
 * another, and the inner one cannot be installed while the outer one is. Separate
 * origins make them separate apps, which is the only reliable fix.
 */
export function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? '';
  const atRoot = host.startsWith('crm.');
  const base = atRoot ? '' : '/crm';

  return NextResponse.json(
    {
      name: 'HN Core',
      short_name: 'HN Core',
      description: 'The HN Properties desk — inventory, leads, site visits and deals.',
      id: `${base}/`,
      start_url: `${base}/`,
      scope: `${base}/`,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#f4f7fa',
      theme_color: '#304c71',
      lang: 'en-IN',
      icons: [
        { src: '/icon-core-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-core-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-core-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icon-core-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      shortcuts: [
        { name: 'Add a property', short_name: 'Add', url: `${base}/properties/new` },
        { name: 'Leads', short_name: 'Leads', url: `${base}/leads` },
        { name: 'Site visits', short_name: 'Visits', url: `${base}/visits` },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json',
        'Cache-Control': 'public, max-age=300',
      },
    },
  );
}

/**
 * Content-Security-Policy for the site.
 *
 * This ships in Report-Only mode: browsers report what it *would* have blocked
 * without actually blocking anything, so a mistake here cannot take the site
 * down. Google Maps in particular pulls scripts, styles, fonts and images from
 * several hosts, and a policy written blind is very likely to miss one.
 *
 * To enforce it later: browse the public site and the CRM with the browser
 * console open, watch for "Content-Security-Policy" report messages, add any
 * legitimate host they name, then rename the header below from
 * 'Content-Security-Policy-Report-Only' to 'Content-Security-Policy'.
 *
 * 'unsafe-inline' and 'unsafe-eval' are present because Next.js injects inline
 * bootstrap scripts and Tailwind injects inline styles. Removing them needs
 * nonce-based CSP, which is a larger change.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleusercontent.com",
  "connect-src 'self' https://maps.googleapis.com",
  // Both fall under default-src 'self' already, but stated explicitly so that
  // tightening default-src later cannot silently stop the app installing or the
  // service worker registering — a failure that shows up as "it just opens in a
  // browser tab again" rather than as an obvious error.
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  // Stop the site being framed by anyone else — the defence against clickjacking,
  // where an attacker overlays your CRM inside a page of their own.
  { key: 'X-Frame-Options', value: 'DENY' },

  // Stop browsers second-guessing declared content types, which is how an
  // uploaded file can be coaxed into executing as a script.
  { key: 'X-Content-Type-Options', value: 'nosniff' },

  // Don't leak CRM URLs (which contain record IDs) to external sites.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },

  // Nothing here needs these device APIs.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), payment=(), interest-cohort=()' },

  // Force HTTPS for two years, including subdomains.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },

  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    /*
     * Hosts the image optimiser is allowed to fetch from.
     *
     * This was `hostname: '**'`, which let anyone point /_next/image at any file
     * anywhere on the internet and have this site fetch, resize and serve it —
     * an open image proxy running on your bandwidth and your bill, and a way to
     * make requests that appear to originate here.
     *
     * Nothing needed it. Every next/image in the app points at a local file in
     * public/, and property photographs are rendered with plain <img> tags that
     * never touch the optimiser. The Blob host is listed so photographs can be
     * moved to next/image later without this coming back as a puzzle.
     */
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  /*
   * Android looks for Digital Asset Links at this exact path, and a folder whose
   * name starts with a dot is not something the app router will serve, so the
   * request is rewritten to a normal route instead.
   */
  async rewrites() {
    return [{ source: '/.well-known/assetlinks.json', destination: '/api/assetlinks' }];
  },

  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      {
        /*
         * The service worker must not be cached by the CDN or the browser.
         *
         * It is the file that decides what everything else caches, so a stale copy
         * is self-perpetuating: the old worker keeps serving old assets and never
         * learns that a new one exists. Browsers now bypass HTTP cache for worker
         * updates, but the CDN in front of it does not, so say it explicitly.
         */
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;

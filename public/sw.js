/*
 * Service worker for HN Properties.
 *
 * Two jobs: make the site usable on a weak connection, and satisfy the
 * installability requirement so Android offers "Add to home screen".
 *
 * The important part of this file is what it refuses to cache. A service worker
 * writes to disk on the device, survives the tab closing, and is not cleared by
 * signing out. Caching a CRM page would leave an owner's phone number readable on
 * a shared or lost phone long after the session expired — so anything behind a
 * login is fetched from the network and never stored. Only the public marketplace,
 * which is served to anyone anyway, is cached.
 *
 * Bump CACHE_VERSION to retire old caches after a deploy.
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `hn-static-${CACHE_VERSION}`;
const PAGE_CACHE = `hn-pages-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

/** Never cached, never served from cache. Everything that is private or personal. */
const NEVER_CACHE = [/^\/api\//, /^\/crm(\/|$)/, /^\/partner(\/|$)/, /^\/login(\/|$)/];

const isPrivate = (pathname) => NEVER_CACHE.some((pattern) => pattern.test(pathname));

/** Build output and icons — content-hashed or rarely changed, so safe to keep. */
const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icon') ||
  url.pathname.startsWith('/favicon') ||
  url.pathname.startsWith('/apple-icon') ||
  /\.(png|jpg|jpeg|webp|avif|svg|woff2?)$/.test(url.pathname);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL])).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !name.endsWith(CACHE_VERSION)).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only GETs are cacheable, and only our own origin is ours to cache.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Anything behind a login goes straight to the network, every time, and no
  // response is written to disk. Returning here leaves the browser to handle it
  // exactly as if no service worker existed.
  if (isPrivate(url.pathname)) return;

  if (isStaticAsset(url)) {
    // Cache first: these are content-hashed, so a hit is always correct.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Public pages: network first, so prices and availability are never stale when
  // there is a connection, with the last good copy as the fallback when there
  // isn't. A cached listing is better than a browser error on a weak signal.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(OFFLINE_URL))),
    );
  }
});

/*
 * Signing out clears the page cache.
 *
 * Public pages hold nothing secret, but a shared phone should not show the last
 * screens the previous person was on. The app posts this message on logout.
 */
self.addEventListener('message', (event) => {
  if (event.data === 'clear-cache') {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name)))));
  }
});

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

/*
 * On the CRM's own host every path is the desk, including "/" and "/leads", so the
 * path patterns above match nothing and the whole site would be cached to disk —
 * owner phone numbers left readable on a shared or lost phone long after the
 * session expired. The host check has to come first for that reason.
 */
const isCrmHost = self.location.hostname.startsWith('crm.');

const isPrivate = (pathname) => isCrmHost || NEVER_CACHE.some((pattern) => pattern.test(pathname));

/** Build output and icons — content-hashed or rarely changed, so safe to keep. */
const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icon') ||
  url.pathname.startsWith('/favicon') ||
  url.pathname.startsWith('/apple-icon') ||
  /\.(png|jpg|jpeg|webp|avif|svg|woff2?)$/.test(url.pathname);

self.addEventListener('install', (event) => {
  // Nothing is precached on the CRM host — there is nothing there it may keep.
  event.waitUntil(
    (isCrmHost
      ? Promise.resolve()
      : caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
    ).then(() => self.skipWaiting()),
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

/*
 * ─── Web Push ────────────────────────────────────────────────────────────────
 *
 * These handlers are what let the installed PWA — and the TWA on Android — raise
 * a notification when the server sends a push, with no tab open. The payload is
 * JSON produced by src/lib/push.ts:  { title, body?, href?, tag?, kind? }
 *
 * Everything here is defensive: a push with no data, or non-JSON data, still
 * shows a sensible notification instead of throwing. A throw in a push handler is
 * invisible to the user and simply drops the notification.
 */

// Per-app mark: the CRM host carries the "core" icon, the marketplace the "app" one.
const NOTIFICATION_ICON = isCrmHost ? '/icon-core-192.png' : '/icon-app-192.png';
const NOTIFICATION_BADGE = '/favicon-32.png';

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    // Not JSON — treat the raw text as the body rather than dropping the push.
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'HN Properties';
  const options = {
    body: payload.body || '',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_BADGE,
    // A tag coalesces repeats (e.g. several updates on one lead) into one entry;
    // renotify re-alerts the user when a tagged notification is replaced.
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    data: { href: payload.href || '/', kind: payload.kind || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const href = (event.notification.data && event.notification.data.href) || '/';
  const target = new URL(href, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Reuse a tab already open on this origin rather than stacking a new one.
      for (const client of clientList) {
        let sameOrigin = false;
        try {
          sameOrigin = new URL(client.url).origin === self.location.origin;
        } catch (err) {
          sameOrigin = false;
        }
        if (sameOrigin && 'focus' in client) {
          if ('navigate' in client) {
            return client
              .navigate(target)
              .catch(() => undefined)
              .then(() => client.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    }),
  );
});

/*
 * The browser occasionally rotates a push subscription on its own. When it does,
 * re-subscribe with the same key and tell the server, so we stop pushing to a dead
 * endpoint. oldSubscription.options carries the original applicationServerKey, so
 * nothing needs hard-coding here. If the user isn't signed in the POST is rejected
 * and the client re-syncs on its next load instead.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  const options = event.oldSubscription ? event.oldSubscription.options : null;
  if (!options) return;
  event.waitUntil(
    self.registration.pushManager.subscribe(options).then((subscription) =>
      fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription, resubscribe: true }),
      }).catch(() => undefined),
    ),
  );
});

'use client';

/**
 * Client-side Web Push plumbing, shared by the owner area and the CRM.
 *
 * Everything browser-specific about enabling notifications lives here — capability
 * checks, the VAPID key conversion, permission, subscribe/unsubscribe and telling
 * the server — so the two surfaces share one implementation and cannot drift.
 */

export type Audience = 'OWNER' | 'STAFF';

export type PushState =
  | 'unsupported' // no service worker / no push / (iOS) not installed
  | 'denied' // the user has blocked notifications for this site
  | 'off' // supported, permitted, but not subscribed
  | 'on'; // subscribed on this device

/** VAPID public keys are base64url; PushManager wants a Uint8Array. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  // Allocate the backing ArrayBuffer explicitly. Under the TS 5.7+ DOM types a bare
  // `new Uint8Array(length)` is Uint8Array<ArrayBufferLike>, and subscribe()'s
  // applicationServerKey requires an ArrayBuffer-backed view — so this must be
  // Uint8Array<ArrayBuffer> or the build fails to compile.
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function vapidKey(): string {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
}

/**
 * iOS only exposes Web Push to a PWA added to the home screen — never in a Safari
 * tab. Reporting "unsupported" there is the honest answer; the UI shows install
 * steps instead of a dead button.
 */
function iosWithoutPwa(): boolean {
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    !!vapidKey() &&
    !iosWithoutPwa()
  );
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

/** The service worker must be registered before a subscription can be read or made. */
async function ready(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

/** What this device is currently doing, without changing anything. */
export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const registration = await ready();
    const sub = await registration.pushManager.getSubscription();
    return sub ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/**
 * Ask permission, subscribe, and register the endpoint with the server.
 *
 * The server decides the identity from the session cookie; `audience` is only a
 * hint so the right session is checked on a shared host.
 */
export async function enablePush(audience: Audience): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';

  const registration = await ready();
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true, // required by Chrome; we always show a notification
      applicationServerKey: urlBase64ToUint8Array(vapidKey()),
    });
  }

  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), audience }),
  });
  if (!response.ok) throw new Error('Could not save this device');

  return 'on';
}

/** Unsubscribe on this device and tell the server to forget the endpoint. */
export async function disablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported';
  try {
    const registration = await ready();
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
  } catch {
    // Even if the request or the local unsubscribe failed, report the intent so the
    // UI does not look stuck; a reload will reconcile with the true state.
  }
  return 'off';
}

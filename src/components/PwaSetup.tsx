'use client';

import { useEffect, useState } from 'react';

/**
 * Registers the service worker and offers installation.
 *
 * Two very different platforms behind one component:
 *
 * Android and desktop Chrome fire `beforeinstallprompt` once the browser decides
 * the site qualifies. Capturing that event lets us show our own button at a
 * sensible moment instead of the browser's banner appearing over a listing.
 *
 * iOS fires nothing and has no programmatic install at all — Safari only offers
 * Share → Add to Home Screen, done by hand. So on iPhone the best available
 * option is a short instruction, shown once. Pretending otherwise would mean a
 * button that does nothing on half the phones in Jabalpur.
 *
 * Either way this is dismissible and remembered, because an install prompt that
 * reappears on every visit is worse than no prompt.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED_KEY = 'hn-install-dismissed';

export default function PwaSetup() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Registered after load so it never competes with the page's own requests.
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === '1';
    } catch {
      // Private browsing can throw on localStorage; treat it as not dismissed.
    }
    if (dismissed) return;

    // Already installed — running from the home screen icon. Nothing to offer.
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (installed) return;

    const onPrompt = (event: Event) => {
      event.preventDefault(); // stop the browser's own banner; we choose the moment
      setDeferred(event as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // iOS Safari: no event will ever arrive, so decide from the platform instead.
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) {
      const timer = setTimeout(() => setShowIosHint(true), 4000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', onPrompt);
      };
    }

    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Nothing to do — it will simply be offered again next visit.
    }
    setDeferred(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice; // resolves whichever way they choose
    dismiss();
  }

  if (!deferred && !showIosHint) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-sm rounded-2xl bg-[var(--plate)] p-4 shadow-lg ring-1 ring-black/5 sm:left-3 sm:right-auto">
      <div className="flex items-start gap-3">
        {/* Decorative: the text beside it already says what this is. */}
        <img src="/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Add HN Properties to your home screen</p>
          {showIosHint ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Tap the Share button below, then choose <strong>Add to Home Screen</strong>.
            </p>
          ) : (
            <p className="mt-1 text-xs text-[var(--muted)]">Opens like an app, and works on a weak signal.</p>
          )}
          <div className="mt-3 flex gap-2">
            {deferred && (
              <button type="button" className="btn btn-primary py-1.5 text-xs" onClick={install}>
                Install
              </button>
            )}
            <button type="button" className="btn btn-ghost py-1.5 text-xs" onClick={dismiss}>
              {deferred ? 'Not now' : 'Got it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

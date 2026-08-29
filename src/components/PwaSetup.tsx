'use client';

import { useEffect, useState } from 'react';

/**
 * Registers the service worker and offers installation.
 *
 * Shown as a centred dialog rather than a corner strip. A small card at the edge
 * of the screen reads as an advert and gets ignored; this is the one moment worth
 * interrupting for, so it takes the middle of the screen once and then never
 * again unless the person clears their browser data.
 *
 * Two platforms, two behaviours:
 *
 * Chrome fires `beforeinstallprompt` when it decides the site qualifies, and
 * capturing it lets us choose the moment instead of the browser dropping its own
 * banner over a listing.
 *
 * Safari on iOS fires nothing and has no programmatic install at all, so there
 * the honest option is a short instruction. The same is true whenever Chrome
 * declines to fire — most often because another app from this origin is already
 * installed — which is why the dialog always offers manual steps as a fallback
 * rather than disappearing and leaving no way in.
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * Lets a menu button open this dialog without either side importing the other.
 *
 * The dialog also appears once on its own, but a person who dismissed it — or who
 * installed on one phone and later opens the site on another — needs a way back to
 * it. `openInstallDialog()` is that way, and it ignores the dismissed flag, because
 * someone tapping "Download Our App" has just asked for it.
 */
export const INSTALL_EVENT = 'hn:open-install';

export function openInstallDialog() {
  window.dispatchEvent(new Event(INSTALL_EVENT));
}

type Surface = 'public' | 'crm';

const COPY = {
  public: {
    /** Storage key is per surface: dismissing one app must not hide the other. */
    key: 'hn-install-dismissed-public',
    title: 'Download Our App',
    blurb: 'Browse property in Jabalpur from your home screen. Opens like an app, and keeps working on a weak signal.',
    icon: '/icon-app-192.png',
  },
  crm: {
    key: 'hn-install-dismissed-crm',
    title: 'Download HN Core',
    blurb: 'Your desk on your phone — inventory, leads, visits and deals, one tap from the home screen.',
    icon: '/icon-core-192.png',
  },
} as const;

export default function PwaSetup({ surface = 'public' }: { surface?: Surface }) {
  const copy = COPY[surface];
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState<'ios' | 'desktop' | 'android' | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // After load, so it never competes with the page's own requests.
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(copy.key) === '1';
    } catch {
      // Private browsing can throw on localStorage; treat that as not dismissed.
    }
    // Already running from the installed icon — nothing to offer.
    const installed =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (installed) return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(ua);

    const onPrompt = (event: Event) => {
      event.preventDefault(); // suppress the browser's own banner; we pick the moment
      setDeferred(event as InstallEvent);
      setManual(null);
      // Captured either way, so the menu button can use the real prompt later, but
      // only shown unprompted the first time.
      if (!dismissed) setOpen(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    /*
     * Give Chrome a moment to fire before falling back. If it hasn't by now it
     * isn't going to — either this is Safari, or another app from this origin is
     * already installed and Chrome will not offer a second automatically. Manual
     * steps still work in both cases, so the dialog opens either way.
     */
    const timer = setTimeout(() => {
      setDeferred((current) => {
        if (!current) {
          setManual(isIos ? 'ios' : isAndroid ? 'android' : 'desktop');
          if (!dismissed) setOpen(true);
        }
        return current;
      });
    }, 3000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, [copy.key]);

  /*
   * Opening on request has to work even when the automatic prompt never ran —
   * after a dismissal, the effect above returns early and never worked out which
   * platform this is. So the fallback steps are decided here too, at the moment
   * they are needed.
   */
  useEffect(() => {
    const onAsk = () => {
      setDeferred((current) => {
        if (!current) {
          const ua = window.navigator.userAgent;
          const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
          setManual(isIos ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop');
        }
        return current;
      });
      setOpen(true);
    };
    window.addEventListener(INSTALL_EVENT, onAsk);
    return () => window.removeEventListener(INSTALL_EVENT, onAsk);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(copy.key, '1');
    } catch {
      // Nothing to do — it will simply be offered again next visit.
    }
    setOpen(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice; // resolves whichever way they choose
    dismiss();
  }

  if (!open) return null;

  const steps =
    manual === 'ios'
      ? ['Tap the Share button at the bottom of Safari', 'Scroll down and choose "Add to Home Screen"', 'Tap Add']
      : manual === 'android'
        ? ['Tap the ⋮ menu at the top right of Chrome', 'Choose "Add to Home screen" or "Install app"', 'Tap Install']
        : ['Click the install icon in the address bar, or open the ⋮ menu', 'Choose "Install HN Properties"', 'Click Install'];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-[var(--plate)] p-6 text-center shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Decorative: the heading beside it already names the app. */}
        <img src={copy.icon} alt="" width={80} height={80} className="mx-auto h-20 w-20 rounded-2xl shadow-md" />

        <h2 id="pwa-title" className="display mt-4 text-xl">{copy.title}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{copy.blurb}</p>

        {manual && (
          <ol className="mt-4 space-y-2 text-left text-sm text-[var(--muted)]">
            {steps.map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[var(--brand-soft)] text-[11px] font-semibold text-[var(--brand)]">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-6 flex flex-col gap-2">
          {deferred && (
            <button type="button" className="btn btn-primary w-full" onClick={install}>
              Install
            </button>
          )}
          <button type="button" className="btn btn-ghost w-full" onClick={dismiss}>
            {deferred ? 'Not now' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}

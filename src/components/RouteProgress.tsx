'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * A thin progress bar across the top while a page is on its way.
 *
 * The gap this fills is the one between clicking a link and the next page
 * appearing. On a redirect that gap is longer than usual — the request reaches the
 * edge, is bounced to sign-in, and only then does a page start loading — and with
 * nothing on screen acknowledging the click, the whole thing reads as the site
 * having ignored you and then jumping.
 *
 * It listens for link clicks rather than router events, because the App Router does
 * not expose navigation start. It never calls preventDefault, so if anything here
 * is wrong the link still works exactly as it would have; the worst case is a bar
 * that appears when it need not.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);

  // The new path has rendered, so whatever was loading has arrived.
  useEffect(() => {
    setActive(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      // Modified clicks open elsewhere and never replace this page.
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (anchor.target && anchor.target !== '_self') return;
      // tel:, mailto: and whatsapp links leave the site entirely.
      if (!href.startsWith('/') && !href.startsWith(window.location.origin)) return;

      // Same page — nothing is loading.
      const url = new URL(href, window.location.href);
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      setActive(true);
    }

    // Going back should not leave the bar running.
    const onDone = () => setActive(false);

    document.addEventListener('click', onClick);
    window.addEventListener('pageshow', onDone);
    return () => {
      document.removeEventListener('click', onClick);
      window.removeEventListener('pageshow', onDone);
    };
  }, []);

  if (!active) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-0.5 overflow-hidden print:hidden" aria-hidden="true">
      {/*
        Eases towards the right and waits there rather than completing, because the
        real duration is unknown. A bar that finishes and sits full is a worse lie
        than one that is plainly still going.
      */}
      <span className="progress-sliver block h-full w-full bg-[var(--brand)]" />
    </div>
  );
}

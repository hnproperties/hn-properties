'use client';

import { useEffect, useRef, useState } from 'react';
import Photo from './Photo';

type Item = {
  id?: string;
  url?: string | null;
  thumbUrl?: string | null;
  alt?: string | null;
  [key: string]: unknown;
};

/**
 * Listing gallery. One large image at a time — the cover first, since that is the
 * one chosen in the CRM — with arrows, a thumbnail strip, arrow-key support and
 * swipe on touch. Every photograph gets the same prominence, rather than one big
 * and the rest as afterthoughts.
 */
export default function Gallery({ photos, title }: { photos: Item[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const touchStart = useRef<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);

  // Anything without a file is not a photograph, whatever else it carries.
  const usable = photos.filter((photo) => typeof photo.url === 'string' && photo.url.length > 0);
  const count = usable.length;
  const go = (next: number) => setIndex(((next % count) + count) % count);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') go(index + 1);
      if (event.key === 'ArrowLeft') go(index - 1);
      if (event.key === 'Escape') setZoomed(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  // Keep the active thumbnail in view as the selection moves.
  useEffect(() => {
    const active = strip.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [index]);

  if (count === 0) {
    return (
      <div className="plate flex aspect-[16/10] items-center justify-center text-sm text-[var(--muted)]">
        Photographs available on request
      </div>
    );
  }

  const current = usable[index];

  return (
    <div>
      <div
        className="group relative overflow-hidden rounded-xl bg-slate-100"
        onTouchStart={(e) => (touchStart.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart.current === null) return;
          const delta = e.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(delta) > 45) go(index + (delta < 0 ? 1 : -1));
          touchStart.current = null;
        }}
      >
        <button
          type="button"
          className="block w-full cursor-zoom-in"
          onClick={() => setZoomed(true)}
          aria-label="View larger"
        >
          <div className="aspect-[16/10] w-full">
            <Photo src={current.url} alt={current.alt ?? title} className="h-full w-full object-cover" />
          </div>
        </button>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous photograph"
              className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-[var(--navy)] shadow-lg transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next photograph"
              className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg text-[var(--navy)] shadow-lg transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
            >
              ›
            </button>

            <span className="mono absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <div ref={strip} className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {usable.map((photo, i) => (
            <button
              key={photo.id ?? photo.url ?? i}
              type="button"
              data-index={i}
              onClick={() => setIndex(i)}
              aria-label={`Photograph ${i + 1}`}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === index ? 'border-[var(--brand)]' : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <Photo src={photo.thumbUrl ?? photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Full-screen view */}
      {zoomed && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 text-2xl text-white/80 hover:text-white"
            aria-label="Close"
            onClick={() => setZoomed(false)}
          >
            ✕
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photograph"
                className="absolute left-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
                onClick={(e) => {
                  e.stopPropagation();
                  go(index - 1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Next photograph"
                className="absolute right-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25"
                onClick={(e) => {
                  e.stopPropagation();
                  go(index + 1);
                }}
              >
                ›
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url ?? undefined}
            alt={current.alt ?? title}
            className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <span className="mono absolute bottom-5 text-sm text-white/70">{index + 1} / {count}</span>
        </div>
      )}
    </div>
  );
}

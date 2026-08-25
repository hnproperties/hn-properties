'use client';

import { useState } from 'react';

/**
 * Image with a graceful fallback. A missing file — for instance after moving the
 * project while using the local storage driver — shows a caption instead of the
 * browser's broken-image icon.
 */
export default function Photo({
  src,
  alt = '',
  className,
  fallback = 'Photograph unavailable',
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[var(--paper)] px-3 text-center text-xs text-[var(--muted)]">
        {fallback}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

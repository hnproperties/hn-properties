'use client';

import { useState } from 'react';

export default function ShareButtons({ waHref, url }: { waHref: string; url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
        Share on WhatsApp
      </a>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard unavailable — the link is on screen anyway */
          }
        }}
      >
        {copied ? 'Link copied' : 'Copy link'}
      </button>
    </div>
  );
}

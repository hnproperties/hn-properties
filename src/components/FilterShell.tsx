'use client';

import { useState } from 'react';

/**
 * On a phone the filter panel is taller than the screen, so putting it above the
 * results meant visitors saw a wall of checkboxes before a single property. This
 * collapses it behind a Filters button below 1024px and leaves the desktop
 * sidebar exactly as it was.
 */
export default function FilterShell({
  children,
  activeCount = 0,
}: {
  children: React.ReactNode;
  activeCount?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:contents">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mb-4 flex w-full items-center justify-between rounded-xl border border-[var(--line)] bg-white px-4 py-3 font-semibold text-[var(--navy)] shadow-sm lg:hidden"
      >
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
            <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="rounded-full bg-[var(--brand)] px-2 py-0.5 text-xs text-white">{activeCount}</span>
          )}
        </span>
        <span aria-hidden className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      <div className={`${open ? 'mb-6 block' : 'hidden'} lg:block`}>{children}</div>
    </div>
  );
}

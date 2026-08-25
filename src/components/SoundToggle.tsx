'use client';

import { useEffect, useState } from 'react';
import { play, setSoundEnabled, soundEnabled, unlockAudio } from '@/lib/sound';

/**
 * Mute switch, plus the listener that unlocks audio on the first interaction.
 *
 * `subtleClicks` adds a very quiet tick to primary buttons and links. It is opt-in
 * per surface: useful in the CRM where actions have weight, and used sparingly on
 * the public site — a sound on every click wears thin quickly.
 */
export default function SoundToggle({
  subtleClicks = false,
  className = '',
  label = 'Sound',
}: {
  subtleClicks?: boolean;
  className?: string;
  label?: string;
}) {
  const [on, setOn] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setOn(soundEnabled());
    setReady(true);

    const unlock = () => unlockAudio();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    if (!subtleClicks) {
      return () => {
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
      };
    }

    // Only the deliberate actions: primary buttons and nav links, never every element.
    function onClick(event: MouseEvent) {
      const target = (event.target as HTMLElement)?.closest('button, a');
      if (!target) return;
      if (target.hasAttribute('data-no-sound')) return;
      const classes = target.className?.toString() ?? '';
      if (!/btn-primary|btn-navy|btn-brass|btn-accent/.test(classes)) return;
      play('tick');
    }

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('click', onClick);
    };
  }, [subtleClicks]);

  if (!ready) return null;

  return (
    <button
      type="button"
      data-no-sound
      aria-pressed={on}
      title={on ? 'Sound on — click to mute' : 'Sound off — click to unmute'}
      onClick={() => {
        unlockAudio();
        const next = !on;
        setOn(next);
        setSoundEnabled(next);
      }}
      className={className || 'text-sm text-[var(--muted)] hover:text-[var(--ink)]'}
    >
      {on ? '🔔' : '🔕'} <span className="sr-only sm:not-sr-only">{label}</span>
    </button>
  );
}

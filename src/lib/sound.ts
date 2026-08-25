/**
 * Sound, synthesised rather than shipped as files.
 *
 * Every tone here is generated with the Web Audio API — a handful of oscillators
 * and a gain envelope — so there are no audio files to download, nothing to cache,
 * and no delay before the first sound plays.
 *
 * Three rules this module keeps:
 *   1. Browsers refuse to play audio before the visitor has interacted with the
 *      page. Nothing is attempted until the first click, so no console errors.
 *   2. Preference is remembered, and honoured everywhere.
 *   3. Anyone who has asked their system for reduced motion gets silence too —
 *      the same people often want fewer interruptions generally.
 */

export type SoundName =
  | 'submission' // a property has arrived for review — the one that must be noticed
  | 'lead'       // a new enquiry
  | 'success'    // published, saved, sent
  | 'error'      // something was refused
  | 'tick';      // a light click

const STORAGE_KEY = 'hn-sound';

type Note = { frequency: number; start: number; duration: number; volume?: number; type?: OscillatorType };

/** Each sound is a short sequence of notes. Kept deliberately brief and quiet. */
const SOUNDS: Record<SoundName, Note[]> = {
  // Two rising notes then a third — enough to turn a head without startling.
  submission: [
    { frequency: 660, start: 0, duration: 0.14, volume: 0.16 },
    { frequency: 880, start: 0.13, duration: 0.14, volume: 0.16 },
    { frequency: 1180, start: 0.27, duration: 0.22, volume: 0.13 },
  ],
  // Softer, single note with a gentle fifth above.
  lead: [
    { frequency: 720, start: 0, duration: 0.12, volume: 0.12 },
    { frequency: 1080, start: 0.1, duration: 0.18, volume: 0.09 },
  ],
  success: [
    { frequency: 620, start: 0, duration: 0.1, volume: 0.11 },
    { frequency: 930, start: 0.09, duration: 0.16, volume: 0.1 },
  ],
  error: [
    { frequency: 300, start: 0, duration: 0.16, volume: 0.12, type: 'triangle' },
    { frequency: 220, start: 0.13, duration: 0.2, volume: 0.1, type: 'triangle' },
  ],
  // Barely there: a short, quiet tick.
  tick: [{ frequency: 1500, start: 0, duration: 0.035, volume: 0.045 }],
};

let context: AudioContext | null = null;
let unlocked = false;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function soundEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  if (reducedMotion()) return false;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setSoundEnabled(on: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
  if (on) play('tick'); // confirm the choice audibly
}

/** Called once on the first interaction; browsers require this before any audio. */
export function unlockAudio() {
  if (unlocked || typeof window === 'undefined') return;
  try {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    context = context ?? new Ctor();
    context.resume?.();
    unlocked = true;
  } catch {
    /* audio is a nicety; never let it throw into the page */
  }
}

export function play(name: SoundName) {
  if (!unlocked || !context || !soundEnabled()) return;

  try {
    const now = context.currentTime;

    for (const note of SOUNDS[name]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = note.type ?? 'sine';
      oscillator.frequency.value = note.frequency;

      const volume = note.volume ?? 0.1;
      const start = now + note.start;
      const end = start + note.duration;

      // Fade in and out — a square-edged envelope clicks unpleasantly.
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(end + 0.02);
    }
  } catch {
    /* silence on failure, never an error in the page */
  }
}

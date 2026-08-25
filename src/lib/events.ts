import { EventEmitter } from 'events';

/**
 * A tiny in-process event bus so a change in one request can be pushed to browsers
 * already connected, rather than waiting for them to ask.
 *
 * Scope: this lives in the memory of one server process. On a single always-on
 * server — which is what `npm run dev` and `npm start` give you — every connected
 * browser hears every event. On a platform that runs several instances (Vercel),
 * a browser only hears events raised by the instance it is connected to, so the
 * client also keeps a slow poll running as a safety net. Moving to a shared
 * pub/sub (Upstash Redis, Ably) would remove that caveat; it is not worth the
 * dependency for a team of this size.
 */
export type ChangeEvent = {
  /** What happened, for the toast wording. */
  kind: 'submission' | 'published' | 'lead' | 'changed';
  /** True when the public website is affected as well as the CRM. */
  publicFacing?: boolean;
  title?: string;
  at: string;
};

const globalForEvents = globalThis as unknown as { hnEvents?: EventEmitter };

export const events =
  globalForEvents.hnEvents ??
  (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200); // one per open tab
    return emitter;
  })();

if (process.env.NODE_ENV !== 'production') globalForEvents.hnEvents = events;

export function emitChange(event: Omit<ChangeEvent, 'at'>) {
  try {
    events.emit('change', { ...event, at: new Date().toISOString() } satisfies ChangeEvent);
  } catch {
    /* a dropped notification must never break the request that caused it */
  }
}

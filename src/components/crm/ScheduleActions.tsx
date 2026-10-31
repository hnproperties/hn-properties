'use client';

import { useState } from 'react';

/**
 * Two actions for anything with a time and an assignee.
 *
 * WhatsApp opens a chat with the message pre-typed — it does not send anything
 * on its own, since no unattended system should message staff on your behalf.
 * You review it and hit send.
 *
 * "Add reminder" opens a small form — date, time, note — rather than
 * immediately downloading a calendar file the way it used to. The reminder
 * time it sets (reminderAt) is deliberately separate from the follow-up's or
 * visit's own due time: the point of a reminder is often "nudge me an hour
 * before," not just re-announce the due time itself. Saving it flags the
 * record; an external scheduler (cron-job.org) calls /api/cron/reminders every
 * few minutes, which sends a real push notification — sound, vibration, stays
 * on screen with a Dismiss button — to whoever it's assigned to, once that
 * chosen time arrives. downloadReminder (the old .ics calendar export) is left
 * here, unused by this button now, in case it's wanted again somewhere.
 */

function pad(value: number) {
  return String(value).padStart(2, '0');
}

/** Calendar files want UTC in the form 20260828T143000Z. */
function toIcsStamp(date: Date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    '00Z'
  );
}

/** Long lines must be folded at 75 octets or some calendar apps reject the file. */
function fold(line: string) {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  out.push(rest);
  return out.join('\r\n');
}

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function downloadReminder({
  title,
  at,
  details,
  minutesBefore = 30,
}: {
  title: string;
  at: string | Date;
  details?: string;
  minutesBefore?: number;
}) {
  const start = new Date(at);
  if (Number.isNaN(start.getTime())) {
    alert('Set a date and time first, then add the reminder.');
    return;
  }
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HN Properties//CRM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@hnproperties.co.in`,
    `DTSTAMP:${toIcsStamp(new Date())}`,
    `DTSTART:${toIcsStamp(start)}`,
    `DTEND:${toIcsStamp(end)}`,
    fold(`SUMMARY:${escapeText(title)}`),
    details ? fold(`DESCRIPTION:${escapeText(details)}`) : '',
    'BEGIN:VALARM',
    `TRIGGER:-PT${minutesBefore}M`,
    'ACTION:DISPLAY',
    fold(`DESCRIPTION:${escapeText(title)}`),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 40) || 'reminder'}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function openWhatsApp({ phone, message }: { phone?: string | null; message: string }) {
  // wa.me wants digits only, with the country code. Indian mobiles are stored as
  // ten digits, so add 91 when it is missing.
  const digits = (phone ?? '').replace(/\D/g, '');
  const withCode = digits.length === 10 ? `91${digits}` : digits;
  const base = withCode ? `https://wa.me/${withCode}` : 'https://wa.me/';
  window.open(`${base}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
}

/** Splits a Date into the separate value strings <input type="date"> and
 * <input type="time"> each want, in the browser's own local time — so the
 * form shows what the person actually set, not a UTC-shifted version of it. */
function splitLocal(date: Date) {
  const d = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const t = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return { d, t };
}

export default function ScheduleActions({
  title,
  at,
  phone,
  message,
  details,
  recordId,
  endpoint,
  initialReminderSet,
}: {
  title: string;
  at?: string | Date | null;
  phone?: string | null;
  message: string;
  details?: string;
  /** The record's own id and its API base path (e.g. '/api/follow-ups') —
   * both are needed to save a reminder against it. Omit either and the Add
   * reminder button does not render at all. */
  recordId?: string;
  endpoint?: string;
  initialReminderSet?: boolean;
}) {
  const [reminderSet, setReminderSet] = useState(!!initialReminderSet);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Defaults the form to the record's own due time (if it has one) so the
  // common case — "remind me when this is due" — is just confirming the
  // already-filled form, while still being fully editable for "remind me
  // before/after that" or a different note than the record's own.
  const fallback = at ? new Date(at) : new Date(Date.now() + 60 * 60 * 1000);
  const initial = splitLocal(Number.isNaN(fallback.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : fallback);
  const [date, setDate] = useState(initial.d);
  const [time, setTime] = useState(initial.t);
  const [note, setNote] = useState(details ?? '');

  async function saveReminder() {
    if (!recordId || !endpoint) return;
    const when = new Date(`${date}T${time}:00`);
    if (Number.isNaN(when.getTime())) {
      setError('Pick a valid date and time.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`${endpoint}/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderRequested: true, reminderAt: when.toISOString(), reminderNote: note || undefined }),
      });
      if (!response.ok) throw new Error('Could not save the reminder');
      setReminderSet(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the reminder');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => openWhatsApp({ phone, message })}>
          💬 WhatsApp
        </button>
        {recordId && endpoint && (
          <button type="button" className="btn btn-ghost" onClick={() => setOpen((v) => !v)}>
            {reminderSet ? '✅ Reminder set' : '⏰ Add reminder'}
          </button>
        )}
      </div>

      {open && (
        /*
         * A fixed, full-screen overlay rather than a dropdown anchored to the
         * button — this button usually sits inside a horizontally-scrolling
         * table (overflow-x-auto on the wrapper), and setting overflow-x to
         * anything but visible makes the browser clip overflow-y too, which
         * silently hid an absolutely-positioned dropdown here. Fixed
         * positioning escapes that entirely, the same way the resource edit
         * drawers elsewhere in the CRM already do.
         */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpen(false)}>
          <div className="glass-plate w-full max-w-sm space-y-3 p-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-[var(--navy)]">{title}</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="label text-xs" htmlFor="rem-date">Date</label>
                <input id="rem-date" type="date" className="field py-1.5 text-sm" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <label className="label text-xs" htmlFor="rem-time">Time</label>
                <input id="rem-time" type="time" className="field py-1.5 text-sm" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label text-xs" htmlFor="rem-note">Note</label>
              <textarea
                id="rem-note"
                className="field py-1.5 text-sm"
                rows={2}
                placeholder="What should the reminder say?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn btn-primary flex-1 py-1.5 text-sm" disabled={busy} onClick={saveReminder}>
                {busy ? 'Saving…' : 'Set reminder'}
              </button>
              <button type="button" className="btn btn-ghost py-1.5 text-sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

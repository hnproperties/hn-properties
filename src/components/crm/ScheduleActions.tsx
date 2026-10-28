'use client';

import { useState } from 'react';

/**
 * Two one-click actions for anything with a time and an assignee.
 *
 * WhatsApp opens a chat with the message pre-typed — it does not send anything
 * on its own, since no unattended system should message staff on your behalf.
 * You review it and hit send.
 *
 * "Add reminder" does two things now, not one. It still downloads a calendar
 * event — a website genuinely cannot set a phone alarm directly, there is no
 * browser API for that, and a calendar file remains the one guaranteed way to
 * get something to ring through the OS's own alarm/calendar app. But it also
 * flags the record (reminderRequested) so the push-based reminder actually
 * fires near the real time: an external scheduler calls /api/cron/reminders
 * every few minutes, which sends a real push notification — sound, vibration,
 * stays on screen with a Dismiss button — to whoever it's assigned to, once
 * due. The calendar file alone never did that on its own; nothing was reading
 * it or acting on it, it only worked if a phone's own calendar app rang it.
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
   * both are needed to flag reminderRequested on it. Omit either and this
   * falls back to the calendar-file-only behaviour from before. */
  recordId?: string;
  endpoint?: string;
  initialReminderSet?: boolean;
}) {
  const [reminderSet, setReminderSet] = useState(!!initialReminderSet);
  const [busy, setBusy] = useState(false);

  async function addReminder() {
    if (at) downloadReminder({ title, at, details });
    if (!recordId || !endpoint) return;
    setBusy(true);
    try {
      const response = await fetch(`${endpoint}/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminderRequested: true }),
      });
      if (response.ok) setReminderSet(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="btn btn-ghost" onClick={() => openWhatsApp({ phone, message })}>
        💬 WhatsApp
      </button>
      {at && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          title={
            reminderSet
              ? 'A push notification will alert you when this is due'
              : 'Downloads a calendar event, and sends you a push notification when this is due'
          }
          onClick={addReminder}
        >
          {reminderSet ? '✅ Reminder set' : '⏰ Add reminder'}
        </button>
      )}
    </div>
  );
}

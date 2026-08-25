import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { events, type ChangeEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Server-sent events for the CRM. The browser holds this connection open and the
 * server writes down it the moment something changes, so the desk updates in the
 * time it takes the message to travel — not on the next poll.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response('Unauthorised', { status: 401 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown, event = 'change') => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          /* the connection has gone; the cleanup below will run */
        }
      };

      send({ ok: true }, 'ready');

      const onChange = (payload: ChangeEvent) => send(payload);
      events.on('change', onChange);

      // Proxies drop idle connections; a comment every 25s keeps this one alive.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          /* closed */
        }
      }, 25000);

      const close = () => {
        clearInterval(heartbeat);
        events.off('change', onChange);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      req.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

import type { NextRequest } from 'next/server';
import { events, type ChangeEvent } from '@/lib/events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * The public equivalent: a signal only, carrying no data beyond "something visible
 * changed". Visitors' browsers use it to refresh the page they are on, so a listing
 * published in the CRM appears without anyone pressing reload.
 */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          /* closed */
        }
      };

      write('event: ready\ndata: {"ok":true}\n\n');

      const onChange = (payload: ChangeEvent) => {
        if (!payload.publicFacing) return; // internal churn is none of the public's business
        write(`event: change\ndata: ${JSON.stringify({ at: payload.at })}\n\n`);
      };

      events.on('change', onChange);
      const heartbeat = setInterval(() => write(': keep-alive\n\n'), 25000);

      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        events.off('change', onChange);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
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

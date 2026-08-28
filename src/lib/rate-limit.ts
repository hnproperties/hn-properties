/**
 * Rate limiting for unauthenticated endpoints.
 *
 * What this is honestly worth: the counter lives in the memory of one serverless
 * instance, and Vercel runs several. A caller spread across instances gets the
 * limit once per instance, so the real ceiling is some multiple of the number set
 * here — unknowable, and it resets whenever an instance is recycled. That makes it
 * useless against a determined distributed scraper and quite effective against the
 * ordinary case: one script, one address, pulling pages in a loop.
 *
 * It is deliberately not backed by the database. A listing search runs on every
 * public page view, and writing a row per request to count them would cost more
 * than the scraping does. Sign-in is the opposite trade — rare, and worth a write
 * to get a limit that actually holds — which is why login throttling counts audit
 * rows instead. When this needs to be real, the change is a shared store (Upstash
 * Redis, or Vercel KV) behind the same function signature.
 */

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

/** Stops the map growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 10_000) return;
  for (const [key, hit] of buckets) {
    if (hit.resetAt <= now) buckets.delete(key);
  }
  // Still large after clearing expired entries — an instance under real load.
  // Drop everything rather than risk unbounded memory; limits restart from zero.
  if (buckets.size >= 10_000) buckets.clear();
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets — for the Retry-After header. */
  retryAfter: number;
};

/**
 * Records a hit against `key` and reports whether it is within the limit.
 * Fixed window: simpler than a sliding one and enough for this purpose.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  if (existing.count > limit) return { allowed: false, remaining: 0, retryAfter };
  return { allowed: true, remaining: Math.max(0, limit - existing.count), retryAfter };
}

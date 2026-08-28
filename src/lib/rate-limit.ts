import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy-init so the Redis client isn't constructed at module load.
// Otherwise a build/import without KV_REST_API_URL or KV_REST_API_TOKEN
// in the environment (e.g. a fresh clone before `vercel env pull`) emits
// noisy "missing url/token" warnings. Constructing on first call defers
// that requirement to the request path where env vars are guaranteed.
let _limiter: Ratelimit | null = null;

export function getRateLimiter(): Ratelimit {
  if (_limiter) return _limiter;

  const redis = new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });

  _limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, "60 s"),
    prefix: "chat",
  });

  return _limiter;
}

/**
 * Fail-open rate limit check.
 *
 * Rate limiting is abuse protection, not a correctness guarantee — it
 * should never be the reason a good request fails. If Upstash is
 * unreachable (instance deleted, DNS failure, credentials unset), we
 * log and let the request through instead of surfacing a 500.
 *
 * This is a deliberate availability-over-enforcement tradeoff, and it
 * was learned the hard way: the Upstash instance backing this limiter
 * was deleted, and because `.limit()` was awaited unguarded on the
 * first line of /api/chat, every chat request 500'd on an
 * ENOTFOUND — while retrieval, the model, and the database were all
 * perfectly healthy. A window of unmetered requests is far cheaper
 * than a dead endpoint.
 */
export async function checkRateLimit(ip: string): Promise<{ success: boolean }> {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    console.warn("[rate-limit] Upstash env vars unset — allowing request");
    return { success: true };
  }

  try {
    const { success } = await getRateLimiter().limit(ip);
    return { success };
  } catch (err) {
    console.error("[rate-limit] check failed, allowing request:", err);
    return { success: true };
  }
}

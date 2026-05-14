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

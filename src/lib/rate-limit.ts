import { NextRequest, NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number;
}

// In-memory store: key → { count, resetAt }
// Fine for single-process deployments; replace with Redis for multi-instance.
const store = new Map<string, Bucket>();

// Prune expired buckets periodically so the Map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 60_000);

export interface RateLimitOptions {
  /** Max requests allowed within the window */
  limit: number;
  /** Window duration in seconds */
  windowSecs: number;
  /** Key prefix to namespace separate limits (e.g. "complaint", "rag") */
  prefix: string;
}

function getClientKey(req: NextRequest, prefix: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return `${prefix}:${ip}`;
}

/**
 * Returns a 429 response if the caller has exceeded the rate limit, otherwise null.
 * Usage: `const limited = rateLimit(req, opts); if (limited) return limited;`
 */
export function rateLimit(
  req: NextRequest,
  opts: RateLimitOptions
): NextResponse | null {
  const key = getClientKey(req, opts.prefix);
  const now = Date.now();
  const windowMs = opts.windowSecs * 1000;

  let bucket = store.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > opts.limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(opts.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}

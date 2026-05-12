// Simple in-memory rate limiter for production
// For distributed systems, use Redis or a rate-limiting service

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  // Convert to array to avoid iterator issues
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  });
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { maxRequests: 10, windowMs: 60 * 60 * 1000 } // 10 per hour default
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // No entry or expired - create new
  if (!entry || entry.resetAt < now) {
    const resetAt = now + config.windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

export function getRateLimitHeaders(result: ReturnType<typeof checkRateLimit>) {
  return {
    "X-RateLimit-Limit": "10",
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": new Date(result.resetAt).toISOString(),
  };
}

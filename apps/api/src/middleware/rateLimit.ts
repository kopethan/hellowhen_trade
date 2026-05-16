import type { NextFunction, Request, RequestHandler, Response } from 'express';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitKeyGenerator = (req: Request) => string;

type RateLimitOptions = {
  keyPrefix: string;
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: RateLimitKeyGenerator;
};

const buckets = new Map<string, RateLimitBucket>();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanupAt = 0;

function cleanupExpiredBuckets(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function headerValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clientIp(req: Request) {
  const forwardedFor = headerValue(req.headers['x-forwarded-for']);
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';

  const realIp = headerValue(req.headers['x-real-ip']);
  if (realIp) return realIp.trim();

  return req.ip || req.socket.remoteAddress || 'unknown';
}

function normalizeKeyPart(value: unknown) {
  if (typeof value !== 'string') return 'missing';
  const normalized = value.trim().toLowerCase();
  return normalized || 'missing';
}

function defaultRateLimitKey(req: Request) {
  return clientIp(req);
}

export function ipAndBodyFieldRateLimitKey(fieldName: string): RateLimitKeyGenerator {
  return (req) => `${clientIp(req)}:${normalizeKeyPart(req.body?.[fieldName])}`;
}

export function createRateLimiter(options: RateLimitOptions): RequestHandler {
  const keyGenerator = options.keyGenerator ?? defaultRateLimitKey;
  const message = options.message ?? 'Too many requests. Please wait and try again.';

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    cleanupExpiredBuckets(now);

    const bucketKey = `${options.keyPrefix}:${keyGenerator(req)}`;
    const existing = buckets.get(bucketKey);
    const bucket = existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    const remaining = Math.max(options.max - bucket.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1);

    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({ error: 'rate_limited', message });
    }

    return next();
  };
}

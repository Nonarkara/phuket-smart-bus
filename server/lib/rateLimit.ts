import type { Request, Response, NextFunction } from "express";
import { HttpError } from "./http.js";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function getClientKey(request: Request) {
  return request.ip || request.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() || "unknown";
}

export function createRateLimit(options: { max: number; windowMs: number; prefix: string }) {
  return function rateLimit(request: Request, response: Response, next: NextFunction) {
    const key = `${options.prefix}:${getClientKey(request)}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs
      });
      next();
      return;
    }

    if (bucket.count >= options.max) {
      response.setHeader("retry-after", Math.ceil((bucket.resetAt - now) / 1000));
      next(new HttpError(429, "rate_limited", "Rate limit exceeded"));
      return;
    }

    bucket.count += 1;
    next();
  };
}

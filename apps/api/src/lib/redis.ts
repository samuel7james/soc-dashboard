import { Redis } from "ioredis";

import { env } from "../config/env.js";

// Lazily connects on first command rather than at import time, so the API can
// still boot (and serve everything that doesn't need caching) if Redis is
// briefly unavailable — connection errors surface per-command, not as a crash.
export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 })
  : null;

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  if (!redis) {
    return load();
  }

  try {
    const hit = await redis.get(key);
    if (hit) {
      return JSON.parse(hit) as T;
    }
  } catch {
    // Redis unreachable — fall through to the source of truth rather than fail the request.
  }

  const value = await load();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Best-effort cache write; a failed SET shouldn't fail the request.
  }

  return value;
}

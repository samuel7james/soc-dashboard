import { Redis } from "ioredis";

import { env } from "../config/env.js";

// BullMQ requires maxRetriesPerRequest: null on the connection it's handed —
// it manages its own retry/backoff semantics for blocking commands.
export const redisConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });

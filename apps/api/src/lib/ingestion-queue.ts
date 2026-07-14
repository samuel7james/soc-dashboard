import { INGESTION_QUEUE_NAME, type IngestionJobData } from "@soc/connectors";
import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { env } from "../config/env.js";

// A separate connection from lib/redis.ts's caching client: BullMQ requires
// maxRetriesPerRequest: null on whatever connection it's handed, which would
// be the wrong setting for a plain cache-get/set client.
const bullConnection = new Redis(env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });

export const ingestionQueue = new Queue<IngestionJobData>(INGESTION_QUEUE_NAME, {
  connection: bullConnection,
});

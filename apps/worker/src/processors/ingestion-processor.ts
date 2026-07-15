import { INGESTION_QUEUE_NAME, type IngestionJobData } from "@soc/connectors";
import { recordIngestionLag, recordQueueJobFailure } from "@soc/observability";
import { Worker } from "bullmq";
import type { Logger } from "pino";

import { redisConnection } from "../lib/redis-connection.js";
import { processIngestionJob } from "../services/ingestion-service.js";

export function startIngestionProcessor(logger: Logger): Worker<IngestionJobData> {
  const worker = new Worker<IngestionJobData>(
    INGESTION_QUEUE_NAME,
    async (job) => {
      recordIngestionLag(Date.now() - job.timestamp);
      await processIngestionJob(job.data, logger);
    },
    { connection: redisConnection, concurrency: 5 },
  );

  worker.on("failed", (job, error) => {
    recordQueueJobFailure(INGESTION_QUEUE_NAME);
    logger.error({ jobId: job?.id, err: error }, "ingestion job failed");
  });

  logger.info("Ingestion queue processor started");
  return worker;
}

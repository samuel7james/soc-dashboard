import { SCHEDULED_REPORTS_QUEUE_NAME } from "@soc/connectors";
import { recordQueueJobFailure } from "@soc/observability";
import { Queue, Worker } from "bullmq";
import type { Logger } from "pino";

import { redisConnection } from "../lib/redis-connection.js";

const DAILY_SUMMARY_JOB = "daily-summary";

// Registers real repeatable-job infrastructure (BullMQ's job scheduler
// API) so scheduled reporting has somewhere to grow into. The processor
// itself is a documented stub: actual report generation reuses the same
// export logic as the on-demand /reports/export endpoint once there's a
// delivery transport (email/webhook) to hand the output to.
export async function startScheduledReports(logger: Logger): Promise<{ queue: Queue; worker: Worker }> {
  const queue = new Queue(SCHEDULED_REPORTS_QUEUE_NAME, { connection: redisConnection });

  // BullMQ 6 removed `repeat` from JobsOptions; repeatable work is now declared
  // as a job scheduler. upsert is idempotent on the scheduler id, so restarting
  // the worker re-declares the same schedule instead of stacking duplicates —
  // which is what the old `jobId` was doing here.
  await queue.upsertJobScheduler(
    DAILY_SUMMARY_JOB,
    { every: 24 * 60 * 60 * 1000 },
    { name: DAILY_SUMMARY_JOB },
  );

  const worker = new Worker(
    SCHEDULED_REPORTS_QUEUE_NAME,
    async (job) => {
      logger.info({ jobName: job.name }, "scheduled report tick (generation/delivery not yet wired up)");
    },
    { connection: redisConnection },
  );

  worker.on("failed", (job, error) => {
    recordQueueJobFailure(SCHEDULED_REPORTS_QUEUE_NAME);
    logger.error({ jobId: job?.id, err: error }, "scheduled report job failed");
  });

  logger.info("Scheduled reports queue registered (daily-summary, no-op processor)");
  return { queue, worker };
}

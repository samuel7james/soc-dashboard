import { SCHEDULED_REPORTS_QUEUE_NAME } from "@soc/connectors";
import { Queue, Worker } from "bullmq";
import type { Logger } from "pino";

import { redisConnection } from "../lib/redis-connection.js";

const DAILY_SUMMARY_JOB = "daily-summary";

// Registers real repeatable-job infrastructure (BullMQ's cron-like `repeat`
// option) so scheduled reporting has somewhere to grow into. The processor
// itself is a documented stub: actual report generation reuses the same
// export logic as the on-demand /reports/export endpoint once there's a
// delivery transport (email/webhook) to hand the output to.
export async function startScheduledReports(logger: Logger): Promise<{ queue: Queue; worker: Worker }> {
  const queue = new Queue(SCHEDULED_REPORTS_QUEUE_NAME, { connection: redisConnection });

  await queue.add(
    DAILY_SUMMARY_JOB,
    {},
    { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: DAILY_SUMMARY_JOB },
  );

  const worker = new Worker(
    SCHEDULED_REPORTS_QUEUE_NAME,
    async (job) => {
      logger.info({ jobName: job.name }, "scheduled report tick (generation/delivery not yet wired up)");
    },
    { connection: redisConnection },
  );

  logger.info("Scheduled reports queue registered (daily-summary, no-op processor)");
  return { queue, worker };
}

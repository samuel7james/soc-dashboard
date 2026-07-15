import { NOTIFICATION_DELIVERY_QUEUE_NAME, type NotificationDeliveryJobData } from "@soc/connectors";
import { prisma } from "@soc/database";
import { recordQueueJobFailure } from "@soc/observability";
import { Worker } from "bullmq";
import type { Logger } from "pino";

import { redisConnection } from "../lib/redis-connection.js";

// No SMTP/webhook transport is configured in this environment, so delivery is
// a logged no-op — the point of this processor is the real queue/worker
// plumbing (enqueue on notification creation, process asynchronously, retry
// on failure) rather than a fabricated "email sent" claim.
export function startNotificationDeliveryProcessor(logger: Logger): Worker<NotificationDeliveryJobData> {
  const worker = new Worker<NotificationDeliveryJobData>(
    NOTIFICATION_DELIVERY_QUEUE_NAME,
    async (job) => {
      const notification = await prisma.notification.findUnique({ where: { id: job.data.notificationId } });
      if (!notification) return;

      logger.info(
        { notificationId: notification.id, userId: notification.userId, title: notification.title },
        "would deliver notification via email/webhook (no transport configured)",
      );
    },
    { connection: redisConnection, concurrency: 5 },
  );

  worker.on("failed", (job, error) => {
    recordQueueJobFailure(NOTIFICATION_DELIVERY_QUEUE_NAME);
    logger.error({ jobId: job?.id, err: error }, "notification delivery job failed");
  });

  logger.info("Notification delivery queue processor started");
  return worker;
}

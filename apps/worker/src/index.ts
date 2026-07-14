import { INGESTION_QUEUE_NAME, type IngestionJobData } from "@soc/connectors";
import { Queue } from "bullmq";
import pino from "pino";

import { env } from "./config/env.js";
import { startDemoModeSupervisor } from "./demo/demo-generator.js";
import { redisConnection } from "./lib/redis-connection.js";
import { startSyslogListener } from "./listeners/syslog-listener.js";
import { startIngestionProcessor } from "./processors/ingestion-processor.js";
import { startNotificationDeliveryProcessor } from "./processors/notification-delivery-processor.js";
import { startScheduledReports } from "./processors/scheduled-reports.js";

const logger = pino(
  env.NODE_ENV === "development"
    ? {
        level: env.LOG_LEVEL,
        transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
      }
    : { level: env.LOG_LEVEL },
);

async function main(): Promise<void> {
  logger.info("Starting SOC Platform worker...");

  const ingestionQueue = new Queue<IngestionJobData>(INGESTION_QUEUE_NAME, { connection: redisConnection });

  const ingestionWorker = startIngestionProcessor(logger);
  const notificationWorker = startNotificationDeliveryProcessor(logger);
  const { queue: reportsQueue, worker: reportsWorker } = await startScheduledReports(logger);
  const syslogSocket = await startSyslogListener(ingestionQueue, logger);
  const demoModeTimer = startDemoModeSupervisor(ingestionQueue, logger);

  logger.info(
    "Worker fully started: ingestion queue, syslog listener, Demo Mode supervisor, notification delivery, scheduled reports.",
  );

  async function shutdown(): Promise<void> {
    logger.info("Shutting down worker...");
    clearInterval(demoModeTimer);
    syslogSocket.close();
    await Promise.all([
      ingestionWorker.close(),
      notificationWorker.close(),
      reportsWorker.close(),
      ingestionQueue.close(),
      reportsQueue.close(),
    ]);
    await redisConnection.quit();
    process.exit(0);
  }

  process.on("SIGTERM", () => void shutdown());
  process.on("SIGINT", () => void shutdown());
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "worker failed to start");
  process.exit(1);
});

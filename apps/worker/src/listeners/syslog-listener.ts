import { createSocket, type Socket } from "node:dgram";

import { syslogToNormalizedEvent, type IngestionJobData } from "@soc/connectors";
import { prisma } from "@soc/database";
import type { Queue } from "bullmq";
import type { Logger } from "pino";

import { env } from "../config/env.js";

const SOURCE_NAME = "Syslog UDP Listener";

async function getOrCreateSyslogSource(): Promise<string> {
  const existing = await prisma.ingestionSource.findFirst({ where: { type: "syslog" } });
  if (existing) return existing.id;

  const created = await prisma.ingestionSource.create({
    data: { name: SOURCE_NAME, type: "syslog", isActive: true },
  });
  return created.id;
}

export async function startSyslogListener(queue: Queue<IngestionJobData>, logger: Logger): Promise<Socket> {
  const ingestionSourceId = await getOrCreateSyslogSource();
  const socket = createSocket("udp4");

  socket.on("message", (msg, rinfo) => {
    const event = syslogToNormalizedEvent(msg.toString("utf8"), rinfo.address);
    if (!event) {
      logger.debug({ from: rinfo.address }, "received datagram that isn't valid RFC3164 syslog — dropped");
      return;
    }

    const jobData: IngestionJobData = {
      ingestionSourceId,
      normalizedType: event.normalizedType,
      payload: event.payload,
      ...(event.sourceIp !== undefined ? { sourceIp: event.sourceIp } : {}),
    };
    // Unawaited by design (a UDP handler can't block on it) — but an
    // uncaught rejection here (e.g. Redis briefly unreachable) would
    // otherwise crash the whole process. Dropping one datagram is fine;
    // losing the entire listener over it isn't.
    queue.add("syslog-event", jobData).catch((error: unknown) => {
      logger.error({ err: error }, "failed to enqueue syslog event");
    });
  });

  socket.on("error", (error) => {
    logger.error({ err: error }, "syslog UDP listener error");
  });

  await new Promise<void>((resolve) => {
    socket.bind(env.SYSLOG_UDP_PORT, env.SYSLOG_UDP_HOST, resolve);
  });

  logger.info(`Syslog UDP listener bound on ${env.SYSLOG_UDP_HOST}:${env.SYSLOG_UDP_PORT}`);
  return socket;
}

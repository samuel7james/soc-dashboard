import { evaluateDetectionRules, type IngestionJobData } from "@soc/connectors";
import { prisma, type Prisma } from "@soc/database";
import type { Logger } from "pino";

import { publishRealtimeEvent } from "../lib/realtime-publish.js";

export async function processIngestionJob(data: IngestionJobData, logger: Logger): Promise<void> {
  const rawEventData: Prisma.RawEventUncheckedCreateInput = {
    ingestionSourceId: data.ingestionSourceId,
    normalizedType: data.normalizedType,
    payload: data.payload as Prisma.InputJsonValue,
  };
  if (data.sourceIp !== undefined) rawEventData.sourceIp = data.sourceIp;

  const rawEvent = await prisma.rawEvent.create({ data: rawEventData });

  await prisma.ingestionSource.update({
    where: { id: data.ingestionSourceId },
    data: { lastIngestedAt: new Date() },
  });

  const detection = evaluateDetectionRules({
    normalizedType: data.normalizedType,
    receivedAt: rawEvent.receivedAt,
    payload: data.payload,
    ...(data.sourceIp !== undefined ? { sourceIp: data.sourceIp } : {}),
  });

  if (!detection) {
    logger.debug({ rawEventId: rawEvent.id }, "no detection rule matched");
    return;
  }

  const alertData: Prisma.AlertUncheckedCreateInput = {
    title: detection.title,
    description: detection.description,
    severity: detection.severity,
    ingestionSourceId: data.ingestionSourceId,
  };
  if (data.sourceIp !== undefined) alertData.sourceIp = data.sourceIp;
  if (detection.mitreTechniqueIds.length > 0) {
    alertData.mitreMappings = {
      create: detection.mitreTechniqueIds.map((mitreTechniqueId) => ({ mitreTechniqueId })),
    };
  }

  const alert = await prisma.alert.create({ data: alertData });

  await publishRealtimeEvent({ type: "alert.created", data: alert });

  logger.info(
    { rawEventId: rawEvent.id, alertId: alert.id, title: alert.title },
    "ingestion produced an alert",
  );
}

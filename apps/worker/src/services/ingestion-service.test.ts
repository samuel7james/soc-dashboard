import { prisma } from "@soc/database";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { processIngestionJob } from "./ingestion-service.js";

const logger = pino({ enabled: false });
const testRunId = crypto.randomUUID().slice(0, 8);

let ingestionSourceId: string;
const createdRawEventIds: string[] = [];
const createdAlertIds: string[] = [];

beforeAll(async () => {
  const source = await prisma.ingestionSource.create({
    data: { name: `test-source-${testRunId}`, type: "syslog", isActive: true },
  });
  ingestionSourceId = source.id;
});

afterAll(async () => {
  await prisma.alertMitreMapping.deleteMany({ where: { alertId: { in: createdAlertIds } } });
  await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
  await prisma.rawEvent.deleteMany({ where: { id: { in: createdRawEventIds } } });
  await prisma.ingestionSource.delete({ where: { id: ingestionSourceId } });
  await prisma.$disconnect();
});

describe("processIngestionJob", () => {
  it("writes a RawEvent and updates the source's lastIngestedAt, producing no alert for benign telemetry", async () => {
    const before = await prisma.rawEvent.count({ where: { ingestionSourceId } });

    await processIngestionJob(
      {
        ingestionSourceId,
        normalizedType: "syslog",
        sourceIp: "203.0.113.10",
        payload: { message: "systemd: Started daily cleanup job." },
      },
      logger,
    );

    const after = await prisma.rawEvent.count({ where: { ingestionSourceId } });
    expect(after).toBe(before + 1);

    const source = await prisma.ingestionSource.findUniqueOrThrow({ where: { id: ingestionSourceId } });
    expect(source.lastIngestedAt).not.toBeNull();

    const rawEvent = await prisma.rawEvent.findFirstOrThrow({
      where: { ingestionSourceId },
      orderBy: { receivedAt: "desc" },
    });
    createdRawEventIds.push(rawEvent.id);
  });

  it("creates an Alert with a MITRE mapping when telemetry matches a detection rule", async () => {
    await processIngestionJob(
      {
        ingestionSourceId,
        normalizedType: "syslog",
        sourceIp: "203.0.113.20",
        payload: { message: "sshd[1234]: Failed password for root from 203.0.113.20 port 51515 ssh2" },
      },
      logger,
    );

    const rawEvent = await prisma.rawEvent.findFirstOrThrow({
      where: { ingestionSourceId, sourceIp: "203.0.113.20" },
      orderBy: { receivedAt: "desc" },
    });
    createdRawEventIds.push(rawEvent.id);

    const alert = await prisma.alert.findFirstOrThrow({
      where: { ingestionSourceId, sourceIp: "203.0.113.20" },
      orderBy: { createdAt: "desc" },
      include: { mitreMappings: true },
    });
    createdAlertIds.push(alert.id);

    expect(alert.severity).toBe("medium");
    expect(alert.mitreMappings.map((m) => m.mitreTechniqueId)).toContain("T1110");
  });
});

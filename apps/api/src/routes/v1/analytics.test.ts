import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const analystEmail = `analytics-analyst-${testRunId}@test.local`;

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdAssetIds: string[] = [];
const createdAlertIds: string[] = [];
const createdVulnIds: string[] = [];
const createdSourceIds: string[] = [];
const createdRawEventIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const analyst = await prisma.user.create({
    data: { email: analystEmail, name: "Analyst", role: "analyst", passwordHash },
  });
  createdUserIds.push(analyst.id);
});

afterAll(async () => {
  await prisma.alertMitreMapping.deleteMany({ where: { alertId: { in: createdAlertIds } } });
  await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
  await prisma.vulnerability.deleteMany({ where: { id: { in: createdVulnIds } } });
  await prisma.rawEvent.deleteMany({ where: { id: { in: createdRawEventIds } } });
  await prisma.ingestionSource.deleteMany({ where: { id: { in: createdSourceIds } } });
  await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
  await prisma.$disconnect();
});

async function loggedInAsAnalyst(): Promise<TestClient> {
  const client = new TestClient(app);
  await client.loginAs(analystEmail, password);
  return client;
}

describe("GET /analytics/alerts-trend", () => {
  it("buckets alert counts by day and severity", async () => {
    const client = await loggedInAsAnalyst();

    const alert = await prisma.alert.create({
      data: { title: `trend-fixture-${testRunId}`, severity: "critical", status: "open" },
    });
    createdAlertIds.push(alert.id);

    const res = await client.get("/api/v1/analytics/alerts-trend?days=7");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const today = new Date().toISOString().slice(0, 10);
    const todayPoint = body.items.find((p: { date: string }) => p.date === today);
    expect(todayPoint).toBeDefined();
    expect(todayPoint.critical).toBeGreaterThanOrEqual(1);
    expect(todayPoint.total).toBeGreaterThanOrEqual(todayPoint.critical);
  });
});

describe("GET /analytics/heatmap", () => {
  it("buckets alert counts by day-of-week and hour-of-day", async () => {
    const client = await loggedInAsAnalyst();

    const alert = await prisma.alert.create({
      data: { title: `heatmap-fixture-${testRunId}`, severity: "low", status: "open" },
    });
    createdAlertIds.push(alert.id);

    const res = await client.get("/api/v1/analytics/heatmap?days=1");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const now = new Date();
    const cell = body.items.find(
      (c: { dayOfWeek: number; hour: number }) =>
        c.dayOfWeek === now.getUTCDay() && c.hour === now.getUTCHours(),
    );
    expect(cell).toBeDefined();
    expect(cell.count).toBeGreaterThanOrEqual(1);
  });
});

describe("GET /analytics/mitre-frequency", () => {
  it("counts alerts per MITRE technique", async () => {
    const client = await loggedInAsAnalyst();

    const alert = await prisma.alert.create({
      data: {
        title: `mitre-fixture-${testRunId}`,
        severity: "high",
        status: "open",
        mitreMappings: { create: [{ mitreTechniqueId: "T1110" }] },
      },
    });
    createdAlertIds.push(alert.id);

    const res = await client.get("/api/v1/analytics/mitre-frequency");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const t1110 = body.items.find((i: { techniqueId: string }) => i.techniqueId === "T1110");
    expect(t1110).toBeDefined();
    expect(t1110.count).toBeGreaterThanOrEqual(1);
    expect(t1110.name).toBe("Brute Force");
  });
});

describe("GET /analytics/detection-effectiveness", () => {
  it("computes raw-event-to-alert conversion rate per ingestion source", async () => {
    const client = await loggedInAsAnalyst();

    const source = await prisma.ingestionSource.create({
      data: { name: `effectiveness-fixture-${testRunId}`, type: "syslog", isActive: false },
    });
    createdSourceIds.push(source.id);

    const rawEvents = await Promise.all([
      prisma.rawEvent.create({ data: { ingestionSourceId: source.id, payload: { message: "one" } } }),
      prisma.rawEvent.create({ data: { ingestionSourceId: source.id, payload: { message: "two" } } }),
    ]);
    createdRawEventIds.push(...rawEvents.map((r) => r.id));

    const alert = await prisma.alert.create({
      data: {
        title: `effectiveness-alert-${testRunId}`,
        severity: "medium",
        status: "open",
        ingestionSourceId: source.id,
      },
    });
    createdAlertIds.push(alert.id);

    const res = await client.get("/api/v1/analytics/detection-effectiveness");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const entry = body.bySource.find((s: { sourceId: string }) => s.sourceId === source.id);
    expect(entry).toBeDefined();
    expect(entry.rawEventCount).toBe(2);
    expect(entry.alertCount).toBe(1);
    expect(entry.alertRate).toBe(50);
  });
});

describe("GET /analytics/asset-risk", () => {
  it("scores a critical asset with an open critical vulnerability and alert higher than an unaffected one", async () => {
    const client = await loggedInAsAnalyst();

    const [riskyAsset, cleanAsset] = await Promise.all([
      prisma.asset.create({
        data: { name: `risky-${testRunId}`, type: "server", criticality: "critical" },
      }),
      prisma.asset.create({
        data: { name: `clean-${testRunId}`, type: "server", criticality: "critical" },
      }),
    ]);
    createdAssetIds.push(riskyAsset.id, cleanAsset.id);

    const vuln = await prisma.vulnerability.create({
      data: {
        title: `risk-vuln-${testRunId}`,
        severity: "critical",
        status: "open",
        assetId: riskyAsset.id,
      },
    });
    createdVulnIds.push(vuln.id);

    const alert = await prisma.alert.create({
      data: {
        title: `risk-alert-${testRunId}`,
        severity: "critical",
        status: "open",
        assetId: riskyAsset.id,
      },
    });
    createdAlertIds.push(alert.id);

    const res = await client.get("/api/v1/analytics/asset-risk");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const risky = body.items.find((i: { assetId: string }) => i.assetId === riskyAsset.id);
    const clean = body.items.find((i: { assetId: string }) => i.assetId === cleanAsset.id);

    expect(risky).toBeDefined();
    expect(clean).toBeDefined();
    // (25 vuln points + 20 alert points) * 1.3 criticality multiplier = 58.5 -> 59
    expect(risky.riskScore).toBe(59);
    expect(clean.riskScore).toBe(0);
    expect(risky.riskScore).toBeGreaterThan(clean.riskScore);
  });
});

describe("GET /analytics/timeline", () => {
  it("merges alerts and incidents into one chronologically-sorted feed", async () => {
    const client = await loggedInAsAnalyst();

    const alert = await prisma.alert.create({
      data: { title: `timeline-fixture-${testRunId}`, severity: "high", status: "open" },
    });
    createdAlertIds.push(alert.id);

    const res = await client.get("/api/v1/analytics/timeline?days=1&limit=500");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    const entry = body.items.find((i: { id: string }) => i.id === alert.id);
    expect(entry).toBeDefined();
    expect(entry.kind).toBe("alert");

    const timestamps = body.items.map((i: { occurredAt: string }) => i.occurredAt);
    const sorted = [...timestamps].sort((a, b) => b.localeCompare(a));
    expect(timestamps).toEqual(sorted);
  });
});

import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const emails = {
  owner: `hunting-owner-${testRunId}@test.local`,
  analyst: `hunting-analyst-${testRunId}@test.local`,
};

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdSourceIds: string[] = [];
const createdRawEventIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const [owner, analyst] = await Promise.all([
    prisma.user.create({ data: { email: emails.owner, name: "Owner", role: "owner", passwordHash } }),
    prisma.user.create({ data: { email: emails.analyst, name: "Analyst", role: "analyst", passwordHash } }),
  ]);
  createdUserIds.push(owner.id, analyst.id);

  const source = await prisma.ingestionSource.create({
    data: { name: `hunting-test-source-${testRunId}`, type: "file_upload", isActive: false },
  });
  createdSourceIds.push(source.id);

  const event = await prisma.rawEvent.create({
    data: {
      ingestionSourceId: source.id,
      normalizedType: "syslog",
      sourceIp: "203.0.113.55",
      payload: { message: `hunting fixture event ${testRunId}` },
    },
  });
  createdRawEventIds.push(event.id);
});

afterAll(async () => {
  await prisma.rawEvent.deleteMany({ where: { id: { in: createdRawEventIds } } });
  await prisma.ingestionSource.deleteMany({ where: { id: { in: createdSourceIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
  await prisma.$disconnect();
});

async function loggedInAs(role: keyof typeof emails): Promise<TestClient> {
  const client = new TestClient(app);
  await client.loginAs(emails[role], password);
  return client;
}

describe("threat hunting: raw events", () => {
  it("lists raw events filtered by source IP", async () => {
    const client = await loggedInAs("analyst");
    const res = await client.get("/api/v1/hunting/raw-events?sourceIp=203.0.113.55&pageSize=50");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.some((e: { id: string }) => e.id === createdRawEventIds[0])).toBe(true);
  });

  it("filters raw events by ingestion source", async () => {
    const client = await loggedInAs("analyst");
    const res = await client.get(`/api/v1/hunting/raw-events?ingestionSourceId=${createdSourceIds[0]}`);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.every((e: { ingestionSourceId: string }) => e.ingestionSourceId === createdSourceIds[0]),
    ).toBe(true);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await new TestClient(app).get("/api/v1/hunting/raw-events");
    expect(res.statusCode).toBe(401);
  });
});

describe("threat hunting: ingestion sources", () => {
  it("lists ingestion sources", async () => {
    const client = await loggedInAs("analyst");
    const res = await client.get("/api/v1/hunting/sources");
    expect(res.statusCode).toBe(200);
    expect(res.json().items.some((s: { id: string }) => s.id === createdSourceIds[0])).toBe(true);
  });

  it("owner can toggle a source's active flag, analyst cannot", async () => {
    const analystClient = await loggedInAs("analyst");
    const analystAttempt = await analystClient.patch(`/api/v1/hunting/sources/${createdSourceIds[0]}`, {
      isActive: true,
    });
    expect(analystAttempt.statusCode).toBe(403);

    const ownerClient = await loggedInAs("owner");
    const toggled = await ownerClient.patch(`/api/v1/hunting/sources/${createdSourceIds[0]}`, {
      isActive: true,
    });
    expect(toggled.statusCode).toBe(200);
    expect(toggled.json().isActive).toBe(true);

    const revert = await ownerClient.patch(`/api/v1/hunting/sources/${createdSourceIds[0]}`, {
      isActive: false,
    });
    expect(revert.json().isActive).toBe(false);
  });

  it("404s toggling a nonexistent source", async () => {
    const client = await loggedInAs("owner");
    const res = await client.patch(`/api/v1/hunting/sources/${crypto.randomUUID()}`, { isActive: true });
    expect(res.statusCode).toBe(404);
  });
});

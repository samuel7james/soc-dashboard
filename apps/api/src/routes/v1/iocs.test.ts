import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const emails = {
  owner: `iocs-owner-${testRunId}@test.local`,
  analyst: `iocs-analyst-${testRunId}@test.local`,
  readOnly: `iocs-readonly-${testRunId}@test.local`,
};

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdIocIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const [owner, analyst, readOnly] = await Promise.all([
    prisma.user.create({ data: { email: emails.owner, name: "Owner", role: "owner", passwordHash } }),
    prisma.user.create({ data: { email: emails.analyst, name: "Analyst", role: "analyst", passwordHash } }),
    prisma.user.create({
      data: { email: emails.readOnly, name: "Read Only", role: "read_only", passwordHash },
    }),
  ]);
  createdUserIds.push(owner.id, analyst.id, readOnly.id);
});

afterAll(async () => {
  await prisma.iOC.deleteMany({ where: { id: { in: createdIocIds } } });
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

describe("IOC CRUD", () => {
  it("creates an IOC with a default medium severity", async () => {
    const client = await loggedInAs("analyst");

    const created = await client.post("/api/v1/iocs", {
      type: "ip",
      value: `198.51.100.${testRunId.slice(0, 2).charCodeAt(0) % 254}`,
    });
    expect(created.statusCode).toBe(201);
    const ioc = created.json();
    createdIocIds.push(ioc.id);
    expect(ioc.severity).toBe("medium");
  });

  it("rejects a duplicate (type, value) pair with 409", async () => {
    const client = await loggedInAs("analyst");
    const value = `evil-${testRunId}.example.com`;

    const first = await client.post("/api/v1/iocs", { type: "domain", value, severity: "high" });
    expect(first.statusCode).toBe(201);
    createdIocIds.push(first.json().id);

    const duplicate = await client.post("/api/v1/iocs", { type: "domain", value, severity: "low" });
    expect(duplicate.statusCode).toBe(409);
  });

  it("bumps lastSeenAt on update", async () => {
    const client = await loggedInAs("analyst");
    const created = await client.post("/api/v1/iocs", {
      type: "file_hash",
      value: `${testRunId}deadbeefcafebabe`,
      severity: "critical",
    });
    const ioc = created.json();
    createdIocIds.push(ioc.id);
    const originalLastSeenAt = ioc.lastSeenAt;

    const updated = await client.patch(`/api/v1/iocs/${ioc.id}`, { description: "seen again in campaign X" });
    expect(updated.statusCode).toBe(200);
    expect(new Date(updated.json().lastSeenAt).getTime()).toBeGreaterThanOrEqual(
      new Date(originalLastSeenAt).getTime(),
    );
  });

  it("read_only can list but not create or delete", async () => {
    const client = await loggedInAs("readOnly");

    const list = await client.get("/api/v1/iocs");
    expect(list.statusCode).toBe(200);

    const attempt = await client.post("/api/v1/iocs", { type: "ip", value: "203.0.113.99" });
    expect(attempt.statusCode).toBe(403);
  });

  it("analyst cannot delete, owner can", async () => {
    const analystClient = await loggedInAs("analyst");
    const created = await analystClient.post("/api/v1/iocs", {
      type: "url",
      value: `https://phish-${testRunId}.example.com/login`,
    });
    const ioc = created.json();

    const analystDelete = await analystClient.delete(`/api/v1/iocs/${ioc.id}`);
    expect(analystDelete.statusCode).toBe(403);

    const ownerClient = await loggedInAs("owner");
    const ownerDelete = await ownerClient.delete(`/api/v1/iocs/${ioc.id}`);
    expect(ownerDelete.statusCode).toBe(204);

    const fetchAfterDelete = await ownerClient.get(`/api/v1/iocs/${ioc.id}`);
    expect(fetchAfterDelete.statusCode).toBe(404);
  });

  it("404s on a well-formed but nonexistent id", async () => {
    const client = await loggedInAs("readOnly");
    const res = await client.get(`/api/v1/iocs/${crypto.randomUUID()}`);
    expect(res.statusCode).toBe(404);
  });

  it("filters the list by type", async () => {
    const client = await loggedInAs("analyst");
    const created = await client.post("/api/v1/iocs", {
      type: "email",
      value: `attacker-${testRunId}@evil.example.com`,
    });
    createdIocIds.push(created.json().id);

    const filtered = await client.get("/api/v1/iocs?type=email&pageSize=50");
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(body.items.some((i: { id: string }) => i.id === created.json().id)).toBe(true);
    expect(body.items.every((i: { type: string }) => i.type === "email")).toBe(true);
  });

  it("rejects unauthenticated requests", async () => {
    const client = new TestClient(app);
    const res = await client.get("/api/v1/iocs");
    expect(res.statusCode).toBe(401);
  });
});

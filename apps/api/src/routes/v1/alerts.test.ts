import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const analystEmail = `alerts-analyst-${testRunId}@test.local`;
const readOnlyEmail = `alerts-readonly-${testRunId}@test.local`;
const ownerEmail = `alerts-owner-${testRunId}@test.local`;

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdAlertIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const [analyst, readOnly, owner] = await Promise.all([
    prisma.user.create({ data: { email: analystEmail, name: "Analyst", role: "analyst", passwordHash } }),
    prisma.user.create({
      data: { email: readOnlyEmail, name: "Read Only", role: "read_only", passwordHash },
    }),
    prisma.user.create({ data: { email: ownerEmail, name: "Owner", role: "owner", passwordHash } }),
  ]);
  createdUserIds.push(analyst.id, readOnly.id, owner.id);
});

afterAll(async () => {
  await prisma.alertMitreMapping.deleteMany({ where: { alertId: { in: createdAlertIds } } });
  await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
  await prisma.$disconnect();
});

async function asAnalyst(): Promise<TestClient> {
  const client = new TestClient(app);
  await client.loginAs(analystEmail, password);
  return client;
}

async function asOwner(): Promise<TestClient> {
  const client = new TestClient(app);
  await client.loginAs(ownerEmail, password);
  return client;
}

describe("alert CRUD with MITRE technique mapping", () => {
  it("creates an alert with technique mappings and returns mitreTechniqueIds", async () => {
    const client = await asAnalyst();

    const res = await client.post("/api/v1/alerts", {
      title: `Brute force detected ${testRunId}`,
      severity: "high",
      mitreTechniqueIds: ["T1110"],
    });

    expect(res.statusCode).toBe(201);
    const alert = res.json();
    createdAlertIds.push(alert.id);
    expect(alert.status).toBe("open");
    expect(alert.mitreTechniqueIds).toEqual(["T1110"]);
  });

  it("replaces technique mappings on update", async () => {
    const client = await asAnalyst();

    const created = await client.post("/api/v1/alerts", {
      title: `Initial mapping ${testRunId}`,
      severity: "medium",
      mitreTechniqueIds: ["T1566"],
    });
    const alert = created.json();
    createdAlertIds.push(alert.id);
    expect(alert.mitreTechniqueIds).toEqual(["T1566"]);

    const updated = await client.patch(`/api/v1/alerts/${alert.id}`, {
      status: "acknowledged",
      mitreTechniqueIds: ["T1078", "T1059"],
    });

    expect(updated.statusCode).toBe(200);
    const updatedAlert = updated.json();
    expect(updatedAlert.status).toBe("acknowledged");
    expect(new Set(updatedAlert.mitreTechniqueIds)).toEqual(new Set(["T1078", "T1059"]));
  });

  it("filters the list by status and severity", async () => {
    const client = await asAnalyst();

    const created = await client.post("/api/v1/alerts", {
      title: `Low severity noise ${testRunId}`,
      severity: "low",
    });
    createdAlertIds.push(created.json().id);

    const filtered = await client.get("/api/v1/alerts?severity=low&status=open&pageSize=50");
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(
      body.items.every(
        (a: { severity: string; status: string }) => a.severity === "low" && a.status === "open",
      ),
    ).toBe(true);
    expect(body.items.some((a: { id: string }) => a.id === created.json().id)).toBe(true);
  });

  it("read_only can view but not mutate alerts", async () => {
    const client = new TestClient(app);
    await client.loginAs(readOnlyEmail, password);

    const list = await client.get("/api/v1/alerts");
    expect(list.statusCode).toBe(200);

    const attempt = await client.post("/api/v1/alerts", { title: "should fail", severity: "low" });
    expect(attempt.statusCode).toBe(403);
  });

  it("404s updating a nonexistent alert", async () => {
    const client = await asAnalyst();
    const res = await client.patch(`/api/v1/alerts/${crypto.randomUUID()}`, { status: "acknowledged" });
    expect(res.statusCode).toBe(404);
  });

  it("analyst cannot delete, owner can", async () => {
    const analystClient = await asAnalyst();
    const created = await analystClient.post("/api/v1/alerts", {
      title: `to delete ${testRunId}`,
      severity: "low",
    });
    const alert = created.json();

    const analystDelete = await analystClient.delete(`/api/v1/alerts/${alert.id}`);
    expect(analystDelete.statusCode).toBe(403);

    const ownerClient = await asOwner();
    const ownerDelete = await ownerClient.delete(`/api/v1/alerts/${alert.id}`);
    expect(ownerDelete.statusCode).toBe(204);

    const fetchAfterDelete = await ownerClient.get(`/api/v1/alerts/${alert.id}`);
    expect(fetchAfterDelete.statusCode).toBe(404);
  });

  it("404s deleting a nonexistent alert", async () => {
    const client = await asOwner();
    const res = await client.delete(`/api/v1/alerts/${crypto.randomUUID()}`);
    expect(res.statusCode).toBe(404);
  });
});

import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const emails = {
  owner: `incidents-owner-${testRunId}@test.local`,
  analyst: `incidents-analyst-${testRunId}@test.local`,
  readOnly: `incidents-readonly-${testRunId}@test.local`,
};

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdIncidentIds: string[] = [];
const createdAlertIds: string[] = [];

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
  await prisma.incidentTimelineEvent.deleteMany({ where: { incidentId: { in: createdIncidentIds } } });
  await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
  await prisma.incident.deleteMany({ where: { id: { in: createdIncidentIds } } });
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

describe("incident CRUD", () => {
  it("opening an incident seeds a timeline event and links alerts", async () => {
    const client = await loggedInAs("analyst");

    const alertRes = await client.post("/api/v1/alerts", {
      title: `Linked alert ${testRunId}`,
      severity: "high",
    });
    const alert = alertRes.json();
    createdAlertIds.push(alert.id);

    const created = await client.post("/api/v1/incidents", {
      title: `Credential stuffing campaign ${testRunId}`,
      severity: "high",
      alertIds: [alert.id],
    });
    expect(created.statusCode).toBe(201);
    const incident = created.json();
    createdIncidentIds.push(incident.id);
    expect(incident.status).toBe("open");
    expect(incident.closedAt).toBeNull();

    const fetched = await client.get(`/api/v1/incidents/${incident.id}`);
    const body = fetched.json();
    expect(body.timelineEvents).toHaveLength(1);
    expect(body.timelineEvents[0].eventType).toBe("note");
    expect(body.alerts.map((a: { id: string }) => a.id)).toEqual([alert.id]);
  });

  it("adds a status_change timeline event and sets closedAt on resolution", async () => {
    const client = await loggedInAs("analyst");
    const created = await client.post("/api/v1/incidents", {
      title: `To resolve ${testRunId}`,
      severity: "medium",
    });
    const incident = created.json();
    createdIncidentIds.push(incident.id);

    const resolved = await client.patch(`/api/v1/incidents/${incident.id}`, { status: "resolved" });
    expect(resolved.statusCode).toBe(200);
    const body = resolved.json();
    expect(body.status).toBe("resolved");
    expect(body.closedAt).not.toBeNull();

    const fetched = await client.get(`/api/v1/incidents/${incident.id}`);
    const events = fetched.json().timelineEvents;
    expect(events.some((e: { eventType: string; message: string }) => e.eventType === "status_change")).toBe(
      true,
    );
  });

  it("appends a manual timeline note", async () => {
    const client = await loggedInAs("analyst");
    const created = await client.post("/api/v1/incidents", {
      title: `Timeline target ${testRunId}`,
      severity: "low",
    });
    const incident = created.json();
    createdIncidentIds.push(incident.id);

    const note = await client.post(`/api/v1/incidents/${incident.id}/timeline`, {
      message: "Reached out to the affected user for confirmation.",
    });
    expect(note.statusCode).toBe(201);
    expect(note.json().message).toContain("affected user");

    const fetched = await client.get(`/api/v1/incidents/${incident.id}`);
    expect(fetched.json().timelineEvents).toHaveLength(2);
  });

  it("read_only can view but not mutate incidents", async () => {
    const client = await loggedInAs("readOnly");

    const list = await client.get("/api/v1/incidents");
    expect(list.statusCode).toBe(200);

    const attempt = await client.post("/api/v1/incidents", { title: "blocked", severity: "low" });
    expect(attempt.statusCode).toBe(403);
  });

  it("analyst cannot delete, owner can", async () => {
    const analystClient = await loggedInAs("analyst");
    const created = await analystClient.post("/api/v1/incidents", {
      title: `to delete ${testRunId}`,
      severity: "low",
    });
    const incident = created.json();

    const analystDelete = await analystClient.delete(`/api/v1/incidents/${incident.id}`);
    expect(analystDelete.statusCode).toBe(403);

    const ownerClient = await loggedInAs("owner");
    const ownerDelete = await ownerClient.delete(`/api/v1/incidents/${incident.id}`);
    expect(ownerDelete.statusCode).toBe(204);

    const fetchAfterDelete = await ownerClient.get(`/api/v1/incidents/${incident.id}`);
    expect(fetchAfterDelete.statusCode).toBe(404);
  });

  it("404s creating a timeline event on a nonexistent incident", async () => {
    const client = await loggedInAs("analyst");
    const res = await client.post(`/api/v1/incidents/${crypto.randomUUID()}/timeline`, { message: "hi" });
    expect(res.statusCode).toBe(404);
  });

  it("rejects unauthenticated requests", async () => {
    const client = new TestClient(app);
    const res = await client.get("/api/v1/incidents");
    expect(res.statusCode).toBe(401);
  });
});

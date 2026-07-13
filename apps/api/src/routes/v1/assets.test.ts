import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const emails = {
  owner: `assets-owner-${testRunId}@test.local`,
  analyst: `assets-analyst-${testRunId}@test.local`,
  readOnly: `assets-readonly-${testRunId}@test.local`,
};

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdAssetIds: string[] = [];

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
  await prisma.asset.deleteMany({ where: { id: { in: createdAssetIds } } });
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

describe("asset CRUD", () => {
  it("read_only can list and read but not create", async () => {
    const client = await loggedInAs("readOnly");

    const list = await client.get("/api/v1/assets");
    expect(list.statusCode).toBe(200);
    expect(list.json()).toMatchObject({ page: 1, pageSize: 25 });

    const createAttempt = await client.post("/api/v1/assets", {
      name: `blocked-${testRunId}`,
      type: "server",
      criticality: "low",
    });
    expect(createAttempt.statusCode).toBe(403);
  });

  it("analyst can create and update but not delete", async () => {
    const client = await loggedInAs("analyst");

    const created = await client.post("/api/v1/assets", {
      name: `analyst-created-${testRunId}`,
      type: "workstation",
      criticality: "medium",
      tags: ["test"],
    });
    expect(created.statusCode).toBe(201);
    const asset = created.json();
    createdAssetIds.push(asset.id);
    expect(asset.criticality).toBe("medium");

    const updated = await client.patch(`/api/v1/assets/${asset.id}`, { criticality: "high" });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().criticality).toBe("high");

    const deleteAttempt = await client.delete(`/api/v1/assets/${asset.id}`);
    expect(deleteAttempt.statusCode).toBe(403);
  });

  it("owner can delete", async () => {
    const analystClient = await loggedInAs("analyst");
    const created = await analystClient.post("/api/v1/assets", {
      name: `owner-deletes-${testRunId}`,
      type: "server",
      criticality: "low",
    });
    const asset = created.json();

    const ownerClient = await loggedInAs("owner");
    const deleted = await ownerClient.delete(`/api/v1/assets/${asset.id}`);
    expect(deleted.statusCode).toBe(204);

    const fetchAfterDelete = await ownerClient.get(`/api/v1/assets/${asset.id}`);
    expect(fetchAfterDelete.statusCode).toBe(404);
  });

  it("404s on a well-formed but nonexistent id", async () => {
    const client = await loggedInAs("readOnly");
    const res = await client.get(`/api/v1/assets/${crypto.randomUUID()}`);
    expect(res.statusCode).toBe(404);
  });

  it("validates the request body and rejects an invalid type", async () => {
    const client = await loggedInAs("analyst");
    const res = await client.post("/api/v1/assets", { name: "bad-type", type: "not-a-real-type" });
    expect(res.statusCode).toBe(400);
  });

  it("rejects unauthenticated requests", async () => {
    const client = new TestClient(app);
    const res = await client.get("/api/v1/assets");
    expect(res.statusCode).toBe(401);
  });
});

describe("asset pagination and filtering", () => {
  it("paginates and filters by criticality", async () => {
    const client = await loggedInAs("analyst");

    const specimens = await Promise.all(
      ["critical", "critical", "low"].map((criticality, i) =>
        client.post("/api/v1/assets", {
          name: `pagination-${testRunId}-${i}`,
          type: "server",
          criticality,
        }),
      ),
    );
    for (const res of specimens) createdAssetIds.push(res.json().id);

    const filtered = await client.get("/api/v1/assets?criticality=critical&pageSize=1&page=1");
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].criticality).toBe("critical");
    expect(body.total).toBeGreaterThanOrEqual(2);
  });
});

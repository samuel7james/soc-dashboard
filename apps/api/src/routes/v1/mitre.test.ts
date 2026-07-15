import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const email = `mitre-analyst-${testRunId}@test.local`;

let app: FastifyInstance;
const createdUserIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const analyst = await prisma.user.create({
    data: { email, name: "Analyst", role: "analyst", passwordHash },
  });
  createdUserIds.push(analyst.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
  await prisma.$disconnect();
});

async function client(): Promise<TestClient> {
  const c = new TestClient(app);
  await c.loginAs(email, password);
  return c;
}

describe("MITRE ATT&CK technique reference data", () => {
  // The seed script (packages/database/prisma/seed.ts) populates
  // mitre_techniques — real reference data, not fixtures created by this
  // test — since AlertMitreMapping has a hard FK to it.
  it("lists seeded techniques", async () => {
    const res = await (await client()).get("/api/v1/mitre/techniques");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]).toHaveProperty("tactic");
  });

  it("filters by tactic", async () => {
    const all = (await (await client()).get("/api/v1/mitre/techniques")).json().items as { tactic: string }[];
    const someTactic = all[0]!.tactic;

    const filtered = await (
      await client()
    ).get(`/api/v1/mitre/techniques?tactic=${encodeURIComponent(someTactic)}`);
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((t: { tactic: string }) => t.tactic === someTactic)).toBe(true);
  });

  it("an unknown tactic filter returns an empty list, not an error", async () => {
    const res = await (await client()).get("/api/v1/mitre/techniques?tactic=not-a-real-tactic");
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toEqual([]);
  });

  it("rejects unauthenticated requests", async () => {
    const res = await new TestClient(app).get("/api/v1/mitre/techniques");
    expect(res.statusCode).toBe(401);
  });
});

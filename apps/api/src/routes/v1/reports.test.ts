import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const email = `reports-analyst-${testRunId}@test.local`;

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdAlertIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const analyst = await prisma.user.create({
    data: { email, name: "Analyst", role: "analyst", passwordHash },
  });
  createdUserIds.push(analyst.id);

  const alert = await prisma.alert.create({
    data: { title: `report fixture alert ${testRunId}`, severity: "high" },
  });
  createdAlertIds.push(alert.id);
});

afterAll(async () => {
  await prisma.alert.deleteMany({ where: { id: { in: createdAlertIds } } });
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

describe("data export", () => {
  it("exports alerts as CSV by default with a Content-Disposition header", async () => {
    const res = await (await client()).get("/api/v1/reports/export?resource=alerts");
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain('filename="alerts.csv"');
    expect(res.body).toContain("title");
    expect(res.body).toContain(`report fixture alert ${testRunId}`);
  });

  it("exports as JSON when requested", async () => {
    const res = await (await client()).get("/api/v1/reports/export?resource=alerts&format=json");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((a: { id: string }) => a.id === createdAlertIds[0])).toBe(true);
  });

  it("supports incidents, vulnerabilities, and assets as exportable resources", async () => {
    const c = await client();
    for (const resource of ["incidents", "vulnerabilities", "assets"]) {
      const res = await c.get(`/api/v1/reports/export?resource=${resource}&format=json`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    }
  });

  it("rejects an unsupported resource with a validation error", async () => {
    const res = await (await client()).get("/api/v1/reports/export?resource=users");
    expect(res.statusCode).toBe(400);
  });

  it("CSV-escapes values containing commas, quotes, or newlines", async () => {
    const tricky = await prisma.alert.create({
      data: { title: `"quoted", tricky\ntitle ${testRunId}`, severity: "low" },
    });
    createdAlertIds.push(tricky.id);

    const res = await (await client()).get("/api/v1/reports/export?resource=alerts");
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('""quoted""');
  });

  it("rejects unauthenticated requests", async () => {
    const res = await new TestClient(app).get("/api/v1/reports/export?resource=alerts");
    expect(res.statusCode).toBe(401);
  });
});

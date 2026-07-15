import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const emails = {
  owner: `vulns-owner-${testRunId}@test.local`,
  analyst: `vulns-analyst-${testRunId}@test.local`,
  readOnly: `vulns-readonly-${testRunId}@test.local`,
};

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdVulnIds: string[] = [];

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
  await prisma.vulnerability.deleteMany({ where: { id: { in: createdVulnIds } } });
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

describe("vulnerability CRUD", () => {
  it("read_only can list but not create", async () => {
    const client = await loggedInAs("readOnly");

    const list = await client.get("/api/v1/vulnerabilities");
    expect(list.statusCode).toBe(200);

    const attempt = await client.post("/api/v1/vulnerabilities", {
      title: `blocked-${testRunId}`,
      severity: "high",
    });
    expect(attempt.statusCode).toBe(403);
  });

  it("analyst can create and update, sets remediatedAt on remediation", async () => {
    const client = await loggedInAs("analyst");

    const created = await client.post("/api/v1/vulnerabilities", {
      title: `SQLi in login form ${testRunId}`,
      severity: "critical",
      cveId: "CVE-2026-0001",
    });
    expect(created.statusCode).toBe(201);
    const vuln = created.json();
    createdVulnIds.push(vuln.id);
    expect(vuln.status).toBe("open");
    expect(vuln.remediatedAt).toBeNull();

    const remediated = await client.patch(`/api/v1/vulnerabilities/${vuln.id}`, { status: "remediated" });
    expect(remediated.statusCode).toBe(200);
    const body = remediated.json();
    expect(body.status).toBe("remediated");
    expect(body.remediatedAt).not.toBeNull();
  });

  it("does not overwrite remediatedAt on a second remediated update", async () => {
    const client = await loggedInAs("analyst");
    const created = await client.post("/api/v1/vulnerabilities", {
      title: `remediated twice ${testRunId}`,
      severity: "low",
    });
    const vuln = created.json();
    createdVulnIds.push(vuln.id);

    const firstUpdate = await client.patch(`/api/v1/vulnerabilities/${vuln.id}`, { status: "remediated" });
    const firstRemediatedAt = firstUpdate.json().remediatedAt;
    expect(firstRemediatedAt).not.toBeNull();

    const secondUpdate = await client.patch(`/api/v1/vulnerabilities/${vuln.id}`, {
      status: "remediated",
      description: "re-confirmed",
    });
    expect(secondUpdate.json().remediatedAt).toBe(firstRemediatedAt);
  });

  it("analyst cannot delete, owner can", async () => {
    const analystClient = await loggedInAs("analyst");
    const created = await analystClient.post("/api/v1/vulnerabilities", {
      title: `to delete ${testRunId}`,
      severity: "medium",
    });
    const vuln = created.json();

    const analystDelete = await analystClient.delete(`/api/v1/vulnerabilities/${vuln.id}`);
    expect(analystDelete.statusCode).toBe(403);

    const ownerClient = await loggedInAs("owner");
    const ownerDelete = await ownerClient.delete(`/api/v1/vulnerabilities/${vuln.id}`);
    expect(ownerDelete.statusCode).toBe(204);

    const fetchAfterDelete = await ownerClient.get(`/api/v1/vulnerabilities/${vuln.id}`);
    expect(fetchAfterDelete.statusCode).toBe(404);
  });

  it("404s on a well-formed but nonexistent id", async () => {
    const client = await loggedInAs("readOnly");
    const res = await client.get(`/api/v1/vulnerabilities/${crypto.randomUUID()}`);
    expect(res.statusCode).toBe(404);
  });

  it("filters the list by severity and status", async () => {
    const client = await loggedInAs("analyst");
    const created = await client.post("/api/v1/vulnerabilities", {
      title: `filter target ${testRunId}`,
      severity: "high",
    });
    createdVulnIds.push(created.json().id);

    const filtered = await client.get("/api/v1/vulnerabilities?severity=high&status=open&pageSize=50");
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(body.items.some((v: { id: string }) => v.id === created.json().id)).toBe(true);
    expect(
      body.items.every(
        (v: { severity: string; status: string }) => v.severity === "high" && v.status === "open",
      ),
    ).toBe(true);
  });

  it("rejects unauthenticated requests", async () => {
    const client = new TestClient(app);
    const res = await client.get("/api/v1/vulnerabilities");
    expect(res.statusCode).toBe(401);
  });
});

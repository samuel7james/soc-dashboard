import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const emails = {
  owner: `users-owner-${testRunId}@test.local`,
  analyst: `users-analyst-${testRunId}@test.local`,
  readOnly: `users-readonly-${testRunId}@test.local`,
};

let app: FastifyInstance;
const createdUserIds: string[] = [];

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

describe("user directory + provisioning", () => {
  it("any authenticated user can list the directory without secrets", async () => {
    const client = await loggedInAs("readOnly");
    const res = await client.get("/api/v1/users");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.some((u: { email: string }) => u.email === emails.owner)).toBe(true);
    for (const user of body.items) {
      expect(user).not.toHaveProperty("passwordHash");
    }
  });

  it("owner can provision a new user", async () => {
    const client = await loggedInAs("owner");
    const email = `provisioned-${testRunId}@test.local`;

    const created = await client.post("/api/v1/users", {
      email,
      password: "another-strong-password-1234",
      name: "New Analyst",
      role: "analyst",
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    createdUserIds.push(body.user.id);
    expect(body.user.email).toBe(email);
    expect(body.user).not.toHaveProperty("passwordHash");

    const newUserCanLogin = await new TestClient(app).loginAs(email, "another-strong-password-1234");
    expect(newUserCanLogin.statusCode).toBe(200);
  });

  it("rejects provisioning a duplicate email with 409", async () => {
    const client = await loggedInAs("owner");

    const attempt = await client.post("/api/v1/users", {
      email: emails.analyst,
      password: "another-strong-password-1234",
      name: "Duplicate",
      role: "analyst",
    });
    expect(attempt.statusCode).toBe(409);
  });

  it("analyst and read_only cannot provision users", async () => {
    const analystClient = await loggedInAs("analyst");
    const analystAttempt = await analystClient.post("/api/v1/users", {
      email: `blocked-analyst-${testRunId}@test.local`,
      password: "another-strong-password-1234",
      name: "Blocked",
      role: "analyst",
    });
    expect(analystAttempt.statusCode).toBe(403);

    const readOnlyClient = await loggedInAs("readOnly");
    const readOnlyAttempt = await readOnlyClient.post("/api/v1/users", {
      email: `blocked-readonly-${testRunId}@test.local`,
      password: "another-strong-password-1234",
      name: "Blocked",
      role: "analyst",
    });
    expect(readOnlyAttempt.statusCode).toBe(403);
  });

  it("rejects a password shorter than the minimum length", async () => {
    const client = await loggedInAs("owner");
    const res = await client.post("/api/v1/users", {
      email: `weak-password-${testRunId}@test.local`,
      password: "short",
      name: "Weak Password",
      role: "analyst",
    });
    expect(res.statusCode).toBe(400);
  });

  it("rejects unauthenticated requests", async () => {
    const client = new TestClient(app);
    const res = await client.get("/api/v1/users");
    expect(res.statusCode).toBe(401);
  });
});

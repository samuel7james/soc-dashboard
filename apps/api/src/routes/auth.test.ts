import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

// Exercises the full HTTP surface (cookies, CSRF, RBAC) against the real local
// Postgres — auth is the one layer where a mocked DB could hide a real bug.
class TestClient {
  private cookies = new Map<string, string>();

  constructor(private readonly app: FastifyInstance) {}

  private cookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private capture(res: LightMyRequestResponse): void {
    for (const cookie of res.cookies) {
      this.cookies.set(cookie.name, cookie.value);
    }
  }

  clearCookie(name: string): void {
    this.cookies.delete(name);
  }

  cookieValue(name: string): string | undefined {
    return this.cookies.get(name);
  }

  async get(url: string): Promise<LightMyRequestResponse> {
    const res = await this.app.inject({ method: "GET", url, headers: { cookie: this.cookieHeader() } });
    this.capture(res);
    return res;
  }

  async post(url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> {
    const headers: Record<string, string> = { cookie: this.cookieHeader() };
    const csrfToken = this.cookies.get("csrf_token");
    if (csrfToken) headers["x-csrf-token"] = csrfToken;

    const res = await this.app.inject({
      method: "POST",
      url,
      headers,
      ...(payload !== undefined ? { payload } : {}),
    });
    this.capture(res);
    return res;
  }

  async primeCsrf(): Promise<void> {
    await this.get("/api/v1/csrf");
  }
}

const testRunId = crypto.randomUUID().slice(0, 8);
const analystEmail = `analyst-${testRunId}@test.local`;
const ownerEmail = `owner-${testRunId}@test.local`;
const password = "correct-horse-battery-staple";

let app: FastifyInstance;
const createdUserIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);

  const analyst = await prisma.user.create({
    data: { email: analystEmail, name: "Test Analyst", role: "analyst", passwordHash },
  });
  const owner = await prisma.user.create({
    data: { email: ownerEmail, name: "Test Owner", role: "owner", passwordHash },
  });
  createdUserIds.push(analyst.id, owner.id);
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
  await prisma.$disconnect();
});

describe("CSRF protection", () => {
  it("rejects a mutating request with no CSRF cookie/header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: analystEmail, password },
    });

    expect(res.statusCode).toBe(403);
  });

  it("rejects a mutating request where the header doesn't match the cookie", async () => {
    const primer = await app.inject({ method: "GET", url: "/api/v1/csrf" });
    const csrfCookie = primer.cookies.find((c) => c.name === "csrf_token")!;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: { email: analystEmail, password },
      headers: {
        cookie: `csrf_token=${csrfCookie.value}`,
        "x-csrf-token": "not-the-right-token",
      },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe("login", () => {
  it("rejects an unknown email with a generic message", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();

    const res = await client.post("/api/v1/auth/login", { email: "nobody@test.local", password });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Invalid email or password");
  });

  it("rejects a known email with the wrong password", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();

    const res = await client.post("/api/v1/auth/login", { email: analystEmail, password: "wrong-password" });

    expect(res.statusCode).toBe(401);
    expect(res.json().message).toBe("Invalid email or password");
  });

  it("accepts correct credentials and sets httpOnly session cookies", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();

    const res = await client.post("/api/v1/auth/login", { email: analystEmail, password });

    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(analystEmail);

    const accessCookie = res.cookies.find((c) => c.name === "access_token")!;
    const refreshCookie = res.cookies.find((c) => c.name === "refresh_token")!;
    expect(accessCookie.httpOnly).toBe(true);
    expect(refreshCookie.httpOnly).toBe(true);
  });
});

describe("session lifecycle", () => {
  it("GET /me is 401 with no session", async () => {
    const client = new TestClient(app);
    const res = await client.get("/api/v1/auth/me");
    expect(res.statusCode).toBe(401);
  });

  it("GET /me returns the user once logged in", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();
    await client.post("/api/v1/auth/login", { email: analystEmail, password });

    const res = await client.get("/api/v1/auth/me");
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe(analystEmail);
  });

  it("refresh rotates the refresh token and issues a new access token", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();
    await client.post("/api/v1/auth/login", { email: analystEmail, password });

    const oldRefreshToken = client.cookieValue("refresh_token");
    const res = await client.post("/api/v1/auth/refresh");

    expect(res.statusCode).toBe(200);
    expect(client.cookieValue("refresh_token")).not.toBe(oldRefreshToken);
  });

  it("reusing a rotated (already-consumed) refresh token revokes the whole session chain", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();
    await client.post("/api/v1/auth/login", { email: analystEmail, password });

    const firstRefreshToken = client.cookieValue("refresh_token")!;
    await client.post("/api/v1/auth/refresh"); // rotates once, firstRefreshToken is now revoked

    // Replay the original (now-stale) refresh token — simulates a stolen token being reused.
    client.clearCookie("refresh_token");
    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: `refresh_token=${firstRefreshToken}; csrf_token=${client.cookieValue("csrf_token")}`,
        "x-csrf-token": client.cookieValue("csrf_token")!,
      },
    });
    expect(replay.statusCode).toBe(401);

    // Theft detection should have revoked the *current* rotated token too.
    const currentRefreshToken = client.cookieValue("refresh_token")!;
    const afterTheft = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: `refresh_token=${currentRefreshToken}; csrf_token=${client.cookieValue("csrf_token")}`,
        "x-csrf-token": client.cookieValue("csrf_token")!,
      },
    });
    expect(afterTheft.statusCode).toBe(401);
  });

  it("logout revokes the session so refresh subsequently fails", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();
    await client.post("/api/v1/auth/login", { email: analystEmail, password });

    const logoutRes = await client.post("/api/v1/auth/logout");
    expect(logoutRes.statusCode).toBe(200);

    const refreshRes = await client.post("/api/v1/auth/refresh");
    expect(refreshRes.statusCode).toBe(401);
  });
});

describe("RBAC", () => {
  it("blocks a non-admin from creating a user", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();
    await client.post("/api/v1/auth/login", { email: analystEmail, password });

    const res = await client.post("/api/v1/users", {
      email: `blocked-${testRunId}@test.local`,
      password: "another-strong-password",
      name: "Should Not Exist",
      role: "analyst",
    });

    expect(res.statusCode).toBe(403);
  });

  it("allows an owner to create a user, and records an audit log entry", async () => {
    const client = new TestClient(app);
    await client.primeCsrf();
    await client.post("/api/v1/auth/login", { email: ownerEmail, password });

    const newEmail = `created-${testRunId}@test.local`;
    const res = await client.post("/api/v1/users", {
      email: newEmail,
      password: "another-strong-password",
      name: "Created By Owner",
      role: "analyst",
    });

    expect(res.statusCode).toBe(201);
    const createdUser = res.json().user;
    createdUserIds.push(createdUser.id);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { action: "user.created", targetId: createdUser.id },
    });
    expect(auditEntry).not.toBeNull();
  });
});

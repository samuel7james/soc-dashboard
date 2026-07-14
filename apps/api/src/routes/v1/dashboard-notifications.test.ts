import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const analystEmail = `dash-analyst-${testRunId}@test.local`;
const adminEmail = `dash-admin-${testRunId}@test.local`;

let app: FastifyInstance;
let analystId: string;
let adminId: string;
const createdUserIds: string[] = [];
const createdNotificationIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const [analyst, admin] = await Promise.all([
    prisma.user.create({ data: { email: analystEmail, name: "Analyst", role: "analyst", passwordHash } }),
    prisma.user.create({ data: { email: adminEmail, name: "Admin", role: "admin", passwordHash } }),
  ]);
  analystId = analyst.id;
  adminId = admin.id;
  createdUserIds.push(analyst.id, admin.id);
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: createdUserIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await app.close();
  await prisma.$disconnect();
});

describe("dashboard summary", () => {
  it("returns real aggregate counts consistent with the database", async () => {
    const client = new TestClient(app);
    await client.loginAs(analystEmail, password);

    // Bracket the request with counts rather than asserting exact equality
    // against a single snapshot: other test files run concurrently against
    // the same database and may insert/delete alerts between reads.
    const before = await prisma.alert.count();
    const res = await client.get("/api/v1/dashboard/summary");
    const after = await prisma.alert.count();

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.alerts.total).toBeGreaterThanOrEqual(Math.min(before, after));
    expect(body.alerts.total).toBeLessThanOrEqual(Math.max(before, after));
    expect(Array.isArray(body.recentAlerts)).toBe(true);
    expect(body.recentAlerts.length).toBeLessThanOrEqual(5);
  });
});

describe("audit logs", () => {
  it("is forbidden for a non-admin role", async () => {
    const client = new TestClient(app);
    await client.loginAs(analystEmail, password);

    const res = await client.get("/api/v1/audit-logs");
    expect(res.statusCode).toBe(403);
  });

  it("allows an admin to list audit logs, most recent first by default", async () => {
    const client = new TestClient(app);
    await client.loginAs(adminEmail, password);

    const res = await client.get("/api/v1/audit-logs?pageSize=5");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.length).toBeGreaterThan(0);

    const timestamps = body.items.map((entry: { createdAt: string }) => new Date(entry.createdAt).getTime());
    const sorted = [...timestamps].sort((a, b) => b - a);
    expect(timestamps).toEqual(sorted);
  });
});

describe("notifications", () => {
  it("lists only the current user's notifications and reports an unread count", async () => {
    const notification = await prisma.notification.create({
      data: { userId: analystId, type: "system", title: "Test notification", message: "hello" },
    });
    createdNotificationIds.push(notification.id);
    // A notification for a different user must never leak into the analyst's list.
    const otherNotification = await prisma.notification.create({
      data: { userId: adminId, type: "system", title: "Not yours", message: "hello" },
    });
    createdNotificationIds.push(otherNotification.id);

    const client = new TestClient(app);
    await client.loginAs(analystEmail, password);

    const res = await client.get("/api/v1/notifications");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.items.some((n: { id: string }) => n.id === notification.id)).toBe(true);
    expect(body.items.some((n: { id: string }) => n.id === otherNotification.id)).toBe(false);
    expect(body.unreadCount).toBeGreaterThanOrEqual(1);
  });

  it("marks a single notification as read", async () => {
    const notification = await prisma.notification.create({
      data: { userId: analystId, type: "system", title: "Mark me read", message: "hello" },
    });
    createdNotificationIds.push(notification.id);

    const client = new TestClient(app);
    await client.loginAs(analystEmail, password);

    const res = await client.post(`/api/v1/notifications/${notification.id}/read`);
    expect(res.statusCode).toBe(200);
    expect(res.json().readAt).not.toBeNull();
  });

  it("cannot mark another user's notification as read", async () => {
    const notification = await prisma.notification.create({
      data: { userId: adminId, type: "system", title: "Admin only", message: "hello" },
    });
    createdNotificationIds.push(notification.id);

    const client = new TestClient(app);
    await client.loginAs(analystEmail, password);

    const res = await client.post(`/api/v1/notifications/${notification.id}/read`);
    expect(res.statusCode).toBe(404);
  });

  it("read-all marks every unread notification for the current user", async () => {
    const [a, b] = await Promise.all([
      prisma.notification.create({ data: { userId: analystId, type: "system", title: "A", message: "a" } }),
      prisma.notification.create({ data: { userId: analystId, type: "system", title: "B", message: "b" } }),
    ]);
    createdNotificationIds.push(a.id, b.id);

    const client = new TestClient(app);
    await client.loginAs(analystEmail, password);

    const res = await client.post("/api/v1/notifications/read-all");
    expect(res.statusCode).toBe(200);

    const remaining = await prisma.notification.count({ where: { userId: analystId, readAt: null } });
    expect(remaining).toBe(0);
  });
});

describe("alert assignment triggers a notification", () => {
  it("notifies the newly assigned user", async () => {
    const client = new TestClient(app);
    await client.loginAs(adminEmail, password);

    const created = await client.post("/api/v1/alerts", {
      title: `Assignment notification test ${testRunId}`,
      severity: "low",
    });
    const alert = created.json();

    await client.patch(`/api/v1/alerts/${alert.id}`, { assignedToId: analystId });

    const notification = await prisma.notification.findFirst({
      where: { userId: analystId, type: "alert", message: alert.title },
    });
    expect(notification).not.toBeNull();
    if (notification) createdNotificationIds.push(notification.id);

    await prisma.alert.delete({ where: { id: alert.id } });
  });
});

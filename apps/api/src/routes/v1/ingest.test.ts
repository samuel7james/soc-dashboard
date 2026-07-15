import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../../app.js";
import { TestClient } from "../../test-utils/test-client.js";

const testRunId = crypto.randomUUID().slice(0, 8);
const password = "correct-horse-battery-staple";
const emails = {
  analyst: `ingest-analyst-${testRunId}@test.local`,
  readOnly: `ingest-readonly-${testRunId}@test.local`,
};

let app: FastifyInstance;
const createdUserIds: string[] = [];
const createdSourceIds: string[] = [];

beforeAll(async () => {
  app = buildApp();
  await app.ready();

  const passwordHash = await hashPassword(password);
  const [analyst, readOnly] = await Promise.all([
    prisma.user.create({ data: { email: emails.analyst, name: "Analyst", role: "analyst", passwordHash } }),
    prisma.user.create({
      data: { email: emails.readOnly, name: "Read Only", role: "read_only", passwordHash },
    }),
  ]);
  createdUserIds.push(analyst.id, readOnly.id);
});

afterAll(async () => {
  const source = await prisma.ingestionSource.findFirst({ where: { type: "file_upload" } });
  if (source) {
    await prisma.rawEvent.deleteMany({ where: { ingestionSourceId: source.id } });
    createdSourceIds.push(source.id);
  }
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

// TestClient only knows JSON payloads — file upload needs a hand-built
// multipart/form-data body, reusing the client's cookie jar (auth + CSRF)
// for the underlying `app.inject()` call.
async function uploadFile(
  client: TestClient,
  filename: string,
  content: string,
  contentType: string,
): Promise<{ statusCode: number; json: () => unknown }> {
  const boundary = `----vitest-${testRunId}`;
  const body = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    `Content-Type: ${contentType}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const cookies = [
    `access_token=${client.cookieValue("access_token") ?? ""}`,
    `csrf_token=${client.cookieValue("csrf_token") ?? ""}`,
  ].join("; ");

  const res = await app.inject({
    method: "POST",
    url: "/api/v1/ingest/upload",
    headers: {
      cookie: cookies,
      "x-csrf-token": client.cookieValue("csrf_token") ?? "",
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    payload: body,
  });
  return { statusCode: res.statusCode, json: () => res.json() };
}

describe("file upload ingestion", () => {
  it("queues one job per CSV row and creates a shared file_upload source", async () => {
    const client = await loggedInAs("analyst");
    const csv = `ip,message\n192.0.2.10,${testRunId} first row\n192.0.2.11,${testRunId} second row\n`;

    const res = await uploadFile(client, "events.csv", csv, "text/csv");
    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; queued: number; ingestionSourceId: string };
    expect(body.status).toBe("success");
    expect(body.queued).toBe(2);

    const source = await prisma.ingestionSource.findUnique({ where: { id: body.ingestionSourceId } });
    expect(source?.type).toBe("file_upload");
  });

  it("accepts a JSON array upload", async () => {
    const client = await loggedInAs("analyst");
    const json = JSON.stringify([{ message: `${testRunId} json row`, ip: "192.0.2.20" }]);

    const res = await uploadFile(client, "events.json", json, "application/json");
    expect(res.statusCode).toBe(200);
    expect((res.json() as { queued: number }).queued).toBe(1);
  });

  it("rejects a JSON body that isn't an array", async () => {
    const client = await loggedInAs("analyst");
    const json = JSON.stringify({ not: "an array" });

    const res = await uploadFile(client, "events.json", json, "application/json");
    expect(res.statusCode).toBe(400);
  });

  it("rejects malformed CSV/JSON with a 400, not a 500", async () => {
    const client = await loggedInAs("analyst");
    const res = await uploadFile(client, "events.json", "{not valid json", "application/json");
    expect(res.statusCode).toBe(400);
  });

  it("rejects a CSV with more than the max row count", async () => {
    const client = await loggedInAs("analyst");
    const rows = Array.from({ length: 1001 }, (_, i) => `192.0.2.1,row ${i}`).join("\n");
    const csv = `ip,message\n${rows}\n`;

    const res = await uploadFile(client, "too-big.csv", csv, "text/csv");
    expect(res.statusCode).toBe(400);
    expect((res.json() as { message: string }).message).toContain("max is 1000");
  });

  it("read_only cannot upload", async () => {
    const client = await loggedInAs("readOnly");
    const res = await uploadFile(client, "events.csv", "ip,message\n1.1.1.1,x\n", "text/csv");
    expect(res.statusCode).toBe(403);
  });
});

import { describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("health routes", () => {
  it("GET /health returns healthy status", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "healthy" });

    await app.close();
  });

  it("GET /ready returns ready status", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/ready" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ready" });

    await app.close();
  });
});

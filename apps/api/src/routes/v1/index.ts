import type { FastifyInstance } from "fastify";

import { registerUserRoutes } from "./users.js";

export async function registerV1Routes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => ({
    name: "SOC Platform API",
    version: "v1",
  }));

  app.get("/csrf", async (request) => ({
    csrfToken: request.cookies.csrf_token,
  }));

  app.register(registerUserRoutes, { prefix: "/users" });

  // Remaining domain routes (alerts, incidents, assets, vulnerabilities,
  // iocs) land in Phase 4/5 once those data models exist.
}

import type { FastifyInstance } from "fastify";

export async function registerV1Routes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => ({
    name: "SOC Platform API",
    version: "v1",
  }));

  // Domain routes (alerts, incidents, assets, vulnerabilities, iocs, users, auth)
  // are added in Phase 4 once the database layer exists.
}

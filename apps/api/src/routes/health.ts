import type { FastifyInstance } from "fastify";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/health", async () => ({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // Readiness is distinct from liveness: it should reflect whether dependencies
  // (database, cache) are reachable, not just that the process is running.
  app.get("/ready", async (_request, reply) => {
    reply.status(200).send({
      status: "ready",
      timestamp: new Date().toISOString(),
    });
  });
}

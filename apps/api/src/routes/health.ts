import { prisma } from "@soc/database";
import type { FastifyInstance } from "fastify";

import { redis } from "../lib/redis.js";

export function registerHealthRoutes(app: FastifyInstance): void {
  app.get("/health", async () => ({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  // Readiness reflects whether the API can actually serve traffic. The
  // database is a hard dependency, checked with a real query. Redis is
  // best-effort: lib/redis.ts already fails open (falls through to Postgres)
  // when the cache is unreachable, so an unreachable Redis shouldn't pull the
  // pod out of a load balancer's rotation the way a dead database should.
  app.get("/ready", async (_request, reply) => {
    const checks: { database: "ok" | "error"; redis: "ok" | "unavailable" | "not_configured" } = {
      database: "error",
      redis: "not_configured",
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    if (redis) {
      try {
        await redis.ping();
        checks.redis = "ok";
      } catch {
        checks.redis = "unavailable";
      }
    }

    const ready = checks.database === "ok";
    reply.status(ready ? 200 : 503).send({
      status: ready ? "ready" : "not_ready",
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}

import { createServer, type Server } from "node:http";

import { prisma } from "@soc/database";
import type { Logger } from "pino";

import { redisConnection } from "./redis-connection.js";

// The worker has no other HTTP surface (it's queue processors + a UDP
// listener) — this exists solely so Kubernetes has something real to probe.
// /health is liveness (process is running and handling requests at all);
// /ready checks the same hard dependencies the processors themselves need
// (Postgres via Prisma, Redis via the same connection BullMQ uses) so a pod
// that can't actually do its job gets pulled out of rotation.
export function startHealthServer(port: number, logger: Logger): Server {
  const server = createServer((request, response) => {
    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "healthy", uptime: process.uptime() }));
      return;
    }

    if (request.url === "/ready") {
      void (async () => {
        const checks = { database: "error", redis: "error" };

        try {
          await prisma.$queryRaw`SELECT 1`;
          checks.database = "ok";
        } catch {
          checks.database = "error";
        }

        try {
          await redisConnection.ping();
          checks.redis = "ok";
        } catch {
          checks.redis = "error";
        }

        const ready = checks.database === "ok" && checks.redis === "ok";
        response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
        response.end(JSON.stringify({ status: ready ? "ready" : "not_ready", checks }));
      })();
      return;
    }

    response.writeHead(404).end();
  });

  server.listen(port, () => logger.info({ port }, "Health check server listening"));
  return server;
}

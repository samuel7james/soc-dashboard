import { prisma, type Prisma } from "@soc/database";
import { rawEventListQuerySchema } from "@soc/types";
import { z } from "zod";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { requireAuth, requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";
import type { TypedApp } from "../../app.js";

const idParamsSchema = z.object({ id: z.string().uuid() });
const toggleSourceSchema = z.object({ isActive: z.boolean() });

export async function registerHuntingRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/raw-events",
    { preHandler: requireAuth, schema: { querystring: rawEventListQuerySchema } },
    async (request) => {
      const { page, pageSize, ingestionSourceId, sourceIp, normalizedType, since } = request.query;
      const where: Prisma.RawEventWhereInput = {
        ...(ingestionSourceId ? { ingestionSourceId } : {}),
        ...(sourceIp ? { sourceIp: { contains: sourceIp } } : {}),
        ...(normalizedType ? { normalizedType } : {}),
        ...(since ? { receivedAt: { gte: new Date(since) } } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.rawEvent.findMany({
          where,
          orderBy: { receivedAt: "desc" },
          ...toSkipTake({ page, pageSize }),
        }),
        prisma.rawEvent.count({ where }),
      ]);

      return toPaginatedResult(items, total, { page, pageSize });
    },
  );

  app.get("/sources", { preHandler: requireAuth }, async () => {
    const items = await prisma.ingestionSource.findMany({ orderBy: { createdAt: "asc" } });
    return { items };
  });

  // Toggles the shared "demo_generator" IngestionSource — the worker's Demo
  // Mode supervisor polls this flag and starts/stops synthetic event
  // generation accordingly. Owner/admin only: this changes what every user
  // sees platform-wide, not a personal preference.
  app.patch(
    "/sources/:id",
    {
      preHandler: requireRole("owner", "admin"),
      schema: { params: idParamsSchema, body: toggleSourceSchema },
    },
    async (request, reply) => {
      const existing = await prisma.ingestionSource.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Ingestion source not found" });
      }

      const source = await prisma.ingestionSource.update({
        where: { id: request.params.id },
        data: { isActive: request.body.isActive },
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: source.isActive ? "ingestion_source.enabled" : "ingestion_source.disabled",
        targetType: "ingestion_source",
        targetId: source.id,
        ipAddress: request.ip,
        metadata: { type: source.type },
      });

      return source;
    },
  );
}

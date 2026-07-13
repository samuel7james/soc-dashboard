import { prisma, type Prisma } from "@soc/database";
import {
  createVulnerabilitySchema,
  updateVulnerabilitySchema,
  vulnerabilityListQuerySchema,
} from "@soc/types";
import { z } from "zod";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { stripUndefined } from "../../lib/strip-undefined.js";
import { requireAuth, requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";
import type { TypedApp } from "../../app.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

export async function registerVulnerabilityRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/",
    { preHandler: requireAuth, schema: { querystring: vulnerabilityListQuerySchema } },
    async (request) => {
      const { page, pageSize, status, severity, assetId, sortBy, sortOrder } = request.query;
      const where: Prisma.VulnerabilityWhereInput = {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(assetId ? { assetId } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.vulnerability.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          ...toSkipTake({ page, pageSize }),
        }),
        prisma.vulnerability.count({ where }),
      ]);

      return toPaginatedResult(items, total, { page, pageSize });
    },
  );

  app.get("/:id", { preHandler: requireAuth, schema: { params: idParamsSchema } }, async (request, reply) => {
    const vulnerability = await prisma.vulnerability.findUnique({ where: { id: request.params.id } });
    if (!vulnerability) {
      return reply.status(404).send({ status: "error", message: "Vulnerability not found" });
    }
    return vulnerability;
  });

  app.post(
    "/",
    { preHandler: requireRole("owner", "admin", "analyst"), schema: { body: createVulnerabilitySchema } },
    async (request, reply) => {
      const vulnerability = await prisma.vulnerability.create({
        data: stripUndefined(request.body) as Prisma.VulnerabilityUncheckedCreateInput,
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "vulnerability.created",
        targetType: "vulnerability",
        targetId: vulnerability.id,
        ipAddress: request.ip,
      });

      reply.status(201);
      return vulnerability;
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: requireRole("owner", "admin", "analyst"),
      schema: { params: idParamsSchema, body: updateVulnerabilitySchema },
    },
    async (request, reply) => {
      const existing = await prisma.vulnerability.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Vulnerability not found" });
      }

      const data: Prisma.VulnerabilityUpdateInput = stripUndefined(request.body);
      if (request.body.status === "remediated" && !existing.remediatedAt) {
        data.remediatedAt = new Date();
      }

      const vulnerability = await prisma.vulnerability.update({ where: { id: request.params.id }, data });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "vulnerability.updated",
        targetType: "vulnerability",
        targetId: vulnerability.id,
        ipAddress: request.ip,
      });

      return vulnerability;
    },
  );

  app.delete(
    "/:id",
    { preHandler: requireRole("owner", "admin"), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const existing = await prisma.vulnerability.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Vulnerability not found" });
      }

      await prisma.vulnerability.delete({ where: { id: request.params.id } });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "vulnerability.deleted",
        targetType: "vulnerability",
        targetId: request.params.id,
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    },
  );
}

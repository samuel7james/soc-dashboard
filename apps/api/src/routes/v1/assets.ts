import { prisma, type Prisma } from "@soc/database";
import { assetListQuerySchema, createAssetSchema, updateAssetSchema } from "@soc/types";
import { z } from "zod";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { stripUndefined } from "../../lib/strip-undefined.js";
import { requireAuth, requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";
import type { TypedApp } from "../../app.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

export async function registerAssetRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/",
    { preHandler: requireAuth, schema: { querystring: assetListQuerySchema } },
    async (request) => {
      const { page, pageSize, type, criticality, sortBy, sortOrder } = request.query;
      const where: Prisma.AssetWhereInput = {
        ...(type ? { type } : {}),
        ...(criticality ? { criticality } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.asset.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...toSkipTake({ page, pageSize }) }),
        prisma.asset.count({ where }),
      ]);

      return toPaginatedResult(items, total, { page, pageSize });
    },
  );

  app.get("/:id", { preHandler: requireAuth, schema: { params: idParamsSchema } }, async (request, reply) => {
    const asset = await prisma.asset.findUnique({ where: { id: request.params.id } });
    if (!asset) {
      return reply.status(404).send({ status: "error", message: "Asset not found" });
    }
    return asset;
  });

  app.post(
    "/",
    { preHandler: requireRole("owner", "admin", "analyst"), schema: { body: createAssetSchema } },
    async (request, reply) => {
      const asset = await prisma.asset.create({
        data: stripUndefined(request.body) as Prisma.AssetUncheckedCreateInput,
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "asset.created",
        targetType: "asset",
        targetId: asset.id,
        ipAddress: request.ip,
      });

      reply.status(201);
      return asset;
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: requireRole("owner", "admin", "analyst"),
      schema: { params: idParamsSchema, body: updateAssetSchema },
    },
    async (request, reply) => {
      const existing = await prisma.asset.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Asset not found" });
      }

      const asset = await prisma.asset.update({
        where: { id: request.params.id },
        data: stripUndefined(request.body),
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "asset.updated",
        targetType: "asset",
        targetId: asset.id,
        ipAddress: request.ip,
      });

      return asset;
    },
  );

  app.delete(
    "/:id",
    { preHandler: requireRole("owner", "admin"), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const existing = await prisma.asset.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Asset not found" });
      }

      await prisma.asset.delete({ where: { id: request.params.id } });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "asset.deleted",
        targetType: "asset",
        targetId: request.params.id,
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    },
  );
}

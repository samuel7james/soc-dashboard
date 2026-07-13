import { prisma, type Prisma } from "@soc/database";
import { createIocSchema, iocListQuerySchema, updateIocSchema } from "@soc/types";
import { z } from "zod";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { stripUndefined } from "../../lib/strip-undefined.js";
import { requireAuth, requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";
import type { TypedApp } from "../../app.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

export async function registerIocRoutes(app: TypedApp): Promise<void> {
  app.get("/", { preHandler: requireAuth, schema: { querystring: iocListQuerySchema } }, async (request) => {
    const { page, pageSize, type, severity, sortBy, sortOrder } = request.query;
    const where: Prisma.IOCWhereInput = {
      ...(type ? { type } : {}),
      ...(severity ? { severity } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.iOC.findMany({ where, orderBy: { [sortBy]: sortOrder }, ...toSkipTake({ page, pageSize }) }),
      prisma.iOC.count({ where }),
    ]);

    return toPaginatedResult(items, total, { page, pageSize });
  });

  app.get("/:id", { preHandler: requireAuth, schema: { params: idParamsSchema } }, async (request, reply) => {
    const ioc = await prisma.iOC.findUnique({ where: { id: request.params.id } });
    if (!ioc) {
      return reply.status(404).send({ status: "error", message: "IOC not found" });
    }
    return ioc;
  });

  app.post(
    "/",
    { preHandler: requireRole("owner", "admin", "analyst"), schema: { body: createIocSchema } },
    async (request, reply) => {
      const existing = await prisma.iOC.findUnique({
        where: { type_value: { type: request.body.type, value: request.body.value } },
      });
      if (existing) {
        return reply.status(409).send({ status: "error", message: "This indicator is already tracked" });
      }

      const ioc = await prisma.iOC.create({
        data: stripUndefined(request.body) as Prisma.IOCUncheckedCreateInput,
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "ioc.created",
        targetType: "ioc",
        targetId: ioc.id,
        ipAddress: request.ip,
      });

      reply.status(201);
      return ioc;
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: requireRole("owner", "admin", "analyst"),
      schema: { params: idParamsSchema, body: updateIocSchema },
    },
    async (request, reply) => {
      const existing = await prisma.iOC.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "IOC not found" });
      }

      const ioc = await prisma.iOC.update({
        where: { id: request.params.id },
        data: { ...stripUndefined(request.body), lastSeenAt: new Date() },
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "ioc.updated",
        targetType: "ioc",
        targetId: ioc.id,
        ipAddress: request.ip,
      });

      return ioc;
    },
  );

  app.delete(
    "/:id",
    { preHandler: requireRole("owner", "admin"), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const existing = await prisma.iOC.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "IOC not found" });
      }

      await prisma.iOC.delete({ where: { id: request.params.id } });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "ioc.deleted",
        targetType: "ioc",
        targetId: request.params.id,
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    },
  );
}

import { prisma, type Alert, type AlertMitreMapping, type Prisma } from "@soc/database";
import { alertListQuerySchema, createAlertSchema, updateAlertSchema } from "@soc/types";
import { z } from "zod";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { stripUndefined } from "../../lib/strip-undefined.js";
import { requireAuth, requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";
import type { TypedApp } from "../../app.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

type AlertWithMappings = Alert & { mitreMappings: AlertMitreMapping[] };

function serializeAlert(alert: AlertWithMappings) {
  const { mitreMappings, ...rest } = alert;
  return { ...rest, mitreTechniqueIds: mitreMappings.map((m) => m.mitreTechniqueId) };
}

export async function registerAlertRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/",
    { preHandler: requireAuth, schema: { querystring: alertListQuerySchema } },
    async (request) => {
      const { page, pageSize, status, severity, assetId, incidentId, sortBy, sortOrder } = request.query;
      const where: Prisma.AlertWhereInput = {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(assetId ? { assetId } : {}),
        ...(incidentId ? { incidentId } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.alert.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          include: { mitreMappings: true },
          ...toSkipTake({ page, pageSize }),
        }),
        prisma.alert.count({ where }),
      ]);

      return toPaginatedResult(items.map(serializeAlert), total, { page, pageSize });
    },
  );

  app.get("/:id", { preHandler: requireAuth, schema: { params: idParamsSchema } }, async (request, reply) => {
    const alert = await prisma.alert.findUnique({
      where: { id: request.params.id },
      include: { mitreMappings: true },
    });
    if (!alert) {
      return reply.status(404).send({ status: "error", message: "Alert not found" });
    }
    return serializeAlert(alert);
  });

  app.post(
    "/",
    { preHandler: requireRole("owner", "admin", "analyst"), schema: { body: createAlertSchema } },
    async (request, reply) => {
      const { mitreTechniqueIds, ...rest } = request.body;

      const alert = await prisma.alert.create({
        data: {
          ...stripUndefined(rest),
          ...(mitreTechniqueIds && mitreTechniqueIds.length > 0
            ? {
                mitreMappings: {
                  create: mitreTechniqueIds.map((mitreTechniqueId) => ({ mitreTechniqueId })),
                },
              }
            : {}),
        } as Prisma.AlertUncheckedCreateInput,
        include: { mitreMappings: true },
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "alert.created",
        targetType: "alert",
        targetId: alert.id,
        ipAddress: request.ip,
        metadata: { severity: alert.severity },
      });

      reply.status(201);
      return serializeAlert(alert);
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: requireRole("owner", "admin", "analyst"),
      schema: { params: idParamsSchema, body: updateAlertSchema },
    },
    async (request, reply) => {
      const existing = await prisma.alert.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Alert not found" });
      }

      const { mitreTechniqueIds, ...rest } = request.body;

      const alert = await prisma.$transaction(async (tx) => {
        if (mitreTechniqueIds) {
          await tx.alertMitreMapping.deleteMany({ where: { alertId: request.params.id } });
          if (mitreTechniqueIds.length > 0) {
            await tx.alertMitreMapping.createMany({
              data: mitreTechniqueIds.map((mitreTechniqueId) => ({
                alertId: request.params.id,
                mitreTechniqueId,
              })),
            });
          }
        }

        return tx.alert.update({
          where: { id: request.params.id },
          data: stripUndefined(rest),
          include: { mitreMappings: true },
        });
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "alert.updated",
        targetType: "alert",
        targetId: alert.id,
        ipAddress: request.ip,
        metadata: { status: alert.status },
      });

      return serializeAlert(alert);
    },
  );

  app.delete(
    "/:id",
    { preHandler: requireRole("owner", "admin"), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const existing = await prisma.alert.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Alert not found" });
      }

      await prisma.alert.delete({ where: { id: request.params.id } });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "alert.deleted",
        targetType: "alert",
        targetId: request.params.id,
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    },
  );
}

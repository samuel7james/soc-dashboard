import { prisma, type Prisma } from "@soc/database";
import {
  createIncidentSchema,
  createIncidentTimelineEventSchema,
  incidentListQuerySchema,
  updateIncidentSchema,
} from "@soc/types";
import { z } from "zod";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { publishRealtimeEvent } from "../../lib/realtime.js";
import { stripUndefined } from "../../lib/strip-undefined.js";
import { requireAuth, requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";
import { notifyUser } from "../../services/notification-service.js";
import type { TypedApp } from "../../app.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

export async function registerIncidentRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/",
    { preHandler: requireAuth, schema: { querystring: incidentListQuerySchema } },
    async (request) => {
      const { page, pageSize, status, severity, assignedToId, sortBy, sortOrder } = request.query;
      const where: Prisma.IncidentWhereInput = {
        ...(status ? { status } : {}),
        ...(severity ? { severity } : {}),
        ...(assignedToId ? { assignedToId } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.incident.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          ...toSkipTake({ page, pageSize }),
        }),
        prisma.incident.count({ where }),
      ]);

      return toPaginatedResult(items, total, { page, pageSize });
    },
  );

  app.get("/:id", { preHandler: requireAuth, schema: { params: idParamsSchema } }, async (request, reply) => {
    const incident = await prisma.incident.findUnique({
      where: { id: request.params.id },
      include: {
        alerts: true,
        timelineEvents: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!incident) {
      return reply.status(404).send({ status: "error", message: "Incident not found" });
    }
    return incident;
  });

  app.post(
    "/",
    { preHandler: requireRole("owner", "admin", "analyst"), schema: { body: createIncidentSchema } },
    async (request, reply) => {
      const { alertIds, ...rest } = request.body;

      const incident = await prisma.$transaction(async (tx) => {
        const created = await tx.incident.create({
          data: {
            ...stripUndefined(rest),
            timelineEvents: {
              create: { authorId: request.user!.sub, eventType: "note", message: "Incident opened" },
            },
          } as Prisma.IncidentUncheckedCreateInput,
        });

        if (alertIds && alertIds.length > 0) {
          await tx.alert.updateMany({ where: { id: { in: alertIds } }, data: { incidentId: created.id } });
        }

        return created;
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "incident.created",
        targetType: "incident",
        targetId: incident.id,
        ipAddress: request.ip,
        metadata: { severity: incident.severity },
      });

      await publishRealtimeEvent({ type: "incident.created", data: incident });

      reply.status(201);
      return incident;
    },
  );

  app.patch(
    "/:id",
    {
      preHandler: requireRole("owner", "admin", "analyst"),
      schema: { params: idParamsSchema, body: updateIncidentSchema },
    },
    async (request, reply) => {
      const existing = await prisma.incident.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Incident not found" });
      }

      const data: Prisma.IncidentUpdateInput = stripUndefined(request.body);
      if (request.body.status && ["resolved", "closed"].includes(request.body.status) && !existing.closedAt) {
        data.closedAt = new Date();
      }

      const incident = await prisma.$transaction(async (tx) => {
        const updated = await tx.incident.update({ where: { id: request.params.id }, data });

        if (request.body.status && request.body.status !== existing.status) {
          await tx.incidentTimelineEvent.create({
            data: {
              incidentId: updated.id,
              authorId: request.user!.sub,
              eventType: "status_change",
              message: `Status changed from ${existing.status} to ${updated.status}`,
            },
          });
        }

        return updated;
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "incident.updated",
        targetType: "incident",
        targetId: incident.id,
        ipAddress: request.ip,
        metadata: { status: incident.status },
      });

      if (request.body.assignedToId && request.body.assignedToId !== existing.assignedToId) {
        await notifyUser({
          userId: request.body.assignedToId,
          type: "incident",
          title: "Incident assigned to you",
          message: incident.title,
        });
      }

      return incident;
    },
  );

  app.delete(
    "/:id",
    { preHandler: requireRole("owner", "admin"), schema: { params: idParamsSchema } },
    async (request, reply) => {
      const existing = await prisma.incident.findUnique({ where: { id: request.params.id } });
      if (!existing) {
        return reply.status(404).send({ status: "error", message: "Incident not found" });
      }

      await prisma.incident.delete({ where: { id: request.params.id } });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "incident.deleted",
        targetType: "incident",
        targetId: request.params.id,
        ipAddress: request.ip,
      });

      return reply.status(204).send();
    },
  );

  app.post(
    "/:id/timeline",
    {
      preHandler: requireRole("owner", "admin", "analyst"),
      schema: { params: idParamsSchema, body: createIncidentTimelineEventSchema },
    },
    async (request, reply) => {
      const incident = await prisma.incident.findUnique({ where: { id: request.params.id } });
      if (!incident) {
        return reply.status(404).send({ status: "error", message: "Incident not found" });
      }

      const event = await prisma.incidentTimelineEvent.create({
        data: {
          incidentId: incident.id,
          authorId: request.user!.sub,
          eventType: "note",
          message: request.body.message,
        },
      });

      reply.status(201);
      return event;
    },
  );
}

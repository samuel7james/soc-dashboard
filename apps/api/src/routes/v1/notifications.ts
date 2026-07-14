import { prisma } from "@soc/database";
import { notificationListQuerySchema } from "@soc/types";
import { z } from "zod";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { requireAuth } from "../../plugins/rbac.js";
import type { TypedApp } from "../../app.js";

const idParamsSchema = z.object({ id: z.string().uuid() });

export async function registerNotificationRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/",
    { preHandler: requireAuth, schema: { querystring: notificationListQuerySchema } },
    async (request) => {
      const { page, pageSize, unreadOnly } = request.query;
      const where = { userId: request.user!.sub, ...(unreadOnly ? { readAt: null } : {}) };

      const [items, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          ...toSkipTake({ page, pageSize }),
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: request.user!.sub, readAt: null } }),
      ]);

      return { ...toPaginatedResult(items, total, { page, pageSize }), unreadCount };
    },
  );

  app.post(
    "/:id/read",
    { preHandler: requireAuth, schema: { params: idParamsSchema } },
    async (request, reply) => {
      const notification = await prisma.notification.findUnique({ where: { id: request.params.id } });
      if (!notification || notification.userId !== request.user!.sub) {
        return reply.status(404).send({ status: "error", message: "Notification not found" });
      }

      const updated = await prisma.notification.update({
        where: { id: request.params.id },
        data: { readAt: notification.readAt ?? new Date() },
      });

      return updated;
    },
  );

  app.post("/read-all", { preHandler: requireAuth }, async (request) => {
    await prisma.notification.updateMany({
      where: { userId: request.user!.sub, readAt: null },
      data: { readAt: new Date() },
    });
    return { status: "success" };
  });
}

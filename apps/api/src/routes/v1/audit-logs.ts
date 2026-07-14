import { prisma, type Prisma } from "@soc/database";
import { auditLogListQuerySchema } from "@soc/types";

import { toPaginatedResult, toSkipTake } from "../../lib/pagination.js";
import { requireRole } from "../../plugins/rbac.js";
import type { TypedApp } from "../../app.js";

export async function registerAuditLogRoutes(app: TypedApp): Promise<void> {
  // Audit logs can reveal who did what across the whole platform — owner/admin only.
  app.get(
    "/",
    { preHandler: requireRole("owner", "admin"), schema: { querystring: auditLogListQuerySchema } },
    async (request) => {
      const { page, pageSize, action, actorId, sortOrder } = request.query;
      const where: Prisma.AuditLogWhereInput = {
        ...(action ? { action } : {}),
        ...(actorId ? { actorId } : {}),
      };

      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: sortOrder },
          ...toSkipTake({ page, pageSize }),
        }),
        prisma.auditLog.count({ where }),
      ]);

      return toPaginatedResult(items, total, { page, pageSize });
    },
  );
}

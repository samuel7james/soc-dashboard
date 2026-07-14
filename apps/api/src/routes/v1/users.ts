import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import { createUserSchema } from "@soc/types";

import { requireAuth, requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";
import type { TypedApp } from "../../app.js";

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function registerUserRoutes(app: TypedApp): Promise<void> {
  // Directory-style read (name/email/role, no secrets) — any authenticated
  // user needs this to populate assignee pickers on alerts/incidents.
  app.get("/", { preHandler: requireAuth }, async () => {
    const items = await prisma.user.findMany({
      select: PUBLIC_USER_FIELDS,
      orderBy: { createdAt: "asc" },
    });

    return { items };
  });

  // No public self-registration: accounts for an internal security tool are
  // provisioned by an owner/admin, not opened up to anonymous sign-up.
  app.post(
    "/",
    { preHandler: requireRole("owner", "admin"), schema: { body: createUserSchema } },
    async (request, reply) => {
      const body = request.body;

      const existing = await prisma.user.findUnique({ where: { email: body.email } });
      if (existing) {
        return reply.status(409).send({ status: "error", message: "A user with this email already exists" });
      }

      const passwordHash = await hashPassword(body.password);
      const user = await prisma.user.create({
        data: { email: body.email, name: body.name, role: body.role, passwordHash },
        select: PUBLIC_USER_FIELDS,
      });

      await recordAuditLog({
        actorId: request.user!.sub,
        action: "user.created",
        targetType: "user",
        targetId: user.id,
        ipAddress: request.ip,
        metadata: { role: user.role },
      });

      reply.status(201);
      return { user };
    },
  );
}

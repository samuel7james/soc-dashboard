import { hashPassword } from "@soc/auth";
import { prisma } from "@soc/database";
import { createUserSchema } from "@soc/types";
import type { FastifyInstance } from "fastify";

import { requireRole } from "../../plugins/rbac.js";
import { recordAuditLog } from "../../services/audit-service.js";

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", { preHandler: requireRole("owner", "admin") }, async () => {
    const items = await prisma.user.findMany({
      select: PUBLIC_USER_FIELDS,
      orderBy: { createdAt: "asc" },
    });

    return { items };
  });

  // No public self-registration: accounts for an internal security tool are
  // provisioned by an owner/admin, not opened up to anonymous sign-up.
  app.post("/", { preHandler: requireRole("owner", "admin") }, async (request, reply) => {
    const body = createUserSchema.parse(request.body);

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
  });
}

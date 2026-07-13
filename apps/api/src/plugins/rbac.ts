import type { UserRole } from "@soc/types";
import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!request.user) {
    await reply.status(401).send({ status: "error", message: "Authentication required" });
  }
}

export function requireRole(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      await reply.status(401).send({ status: "error", message: "Authentication required" });
      return;
    }

    if (!roles.includes(request.user.role as UserRole)) {
      await reply.status(403).send({ status: "error", message: "Insufficient permissions" });
    }
  };
}

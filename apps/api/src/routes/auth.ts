import { loginSchema } from "@soc/types";
import type { FastifyInstance, FastifyReply } from "fastify";

import { requireAuth } from "../plugins/rbac.js";
import {
  AccountInactiveError,
  type AuthResult,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  login,
  logout,
  refresh,
} from "../services/auth-service.js";
import { recordAuditLog } from "../services/audit-service.js";

const isProd = process.env.NODE_ENV === "production";
const REFRESH_COOKIE_PATH = "/api/v1/auth";

function setAuthCookies(reply: FastifyReply, result: AuthResult): void {
  reply.setCookie("access_token", result.accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60,
  });

  reply.setCookie("refresh_token", result.refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    expires: result.refreshTokenExpiresAt,
  });
}

function clearAuthCookies(reply: FastifyReply): void {
  reply.clearCookie("access_token", { path: "/" });
  reply.clearCookie("refresh_token", { path: REFRESH_COOKIE_PATH });
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const body = loginSchema.parse(request.body);

      try {
        const result = await login(body.email, body.password, {
          ipAddress: request.ip,
          userAgent: request.headers["user-agent"],
        });

        setAuthCookies(reply, result);
        await recordAuditLog({ actorId: result.user.id, action: "auth.login", ipAddress: request.ip });

        return { user: result.user };
      } catch (error) {
        if (error instanceof InvalidCredentialsError || error instanceof AccountInactiveError) {
          await recordAuditLog({
            action: "auth.login_failed",
            ipAddress: request.ip,
            metadata: { email: body.email },
          });
          return reply.status(401).send({ status: "error", message: "Invalid email or password" });
        }
        throw error;
      }
    },
  );

  app.post("/refresh", async (request, reply) => {
    const token = request.cookies.refresh_token;

    if (!token) {
      return reply.status(401).send({ status: "error", message: "No refresh token provided" });
    }

    try {
      const result = await refresh(token, {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });

      setAuthCookies(reply, result);
      return { user: result.user };
    } catch (error) {
      clearAuthCookies(reply);
      if (error instanceof InvalidRefreshTokenError || error instanceof AccountInactiveError) {
        return reply.status(401).send({ status: "error", message: "Invalid or expired session" });
      }
      throw error;
    }
  });

  app.post("/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (token) {
      await logout(token);
    }

    clearAuthCookies(reply);
    await recordAuditLog({ actorId: request.user!.sub, action: "auth.logout", ipAddress: request.ip });

    return { status: "success" };
  });

  app.get("/me", { preHandler: requireAuth }, async (request) => {
    const { sub, email, role } = request.user!;
    return { user: { id: sub, email, role } };
  });
}

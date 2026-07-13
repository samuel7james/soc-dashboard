import { type AccessTokenPayload, verifyAccessToken } from "@soc/auth";
import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: AccessTokenPayload;
  }
}

const authenticatePlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("user", undefined);

  app.addHook("onRequest", async (request) => {
    const token = request.cookies.access_token;
    if (!token) {
      return;
    }

    try {
      request.user = await verifyAccessToken(token, env.JWT_ACCESS_SECRET);
    } catch {
      // Invalid/expired token: request proceeds unauthenticated. Routes that
      // require a session enforce that explicitly via requireAuth/requireRole.
    }
  });
};

export default fp(authenticatePlugin);

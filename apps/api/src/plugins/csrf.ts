import { randomBytes } from "node:crypto";

import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

import { env } from "../config/env.js";

const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Double-submit cookie pattern: the token is readable by client JS (not httpOnly)
// so the SPA can echo it back in a header. A cross-site attacker can trigger a
// cookie-bearing request but can't read the cookie to also set the header.
const csrfPlugin: FastifyPluginAsync = async (app) => {
  app.addHook("onRequest", async (request, reply) => {
    if (!request.cookies[CSRF_COOKIE]) {
      const token = randomBytes(24).toString("base64url");
      reply.setCookie(CSRF_COOKIE, token, {
        httpOnly: false,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });
      request.cookies[CSRF_COOKIE] = token;
    }
  });

  app.addHook("preHandler", async (request, reply) => {
    if (SAFE_METHODS.has(request.method) || !request.url.startsWith("/api/v1")) {
      return;
    }

    const cookieToken = request.cookies[CSRF_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      await reply.status(403).send({ status: "error", message: "Missing or invalid CSRF token" });
    }
  });
};

export default fp(csrfPlugin);

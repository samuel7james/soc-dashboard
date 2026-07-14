import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { jsonSchemaTransform, serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ZodError } from "zod";

import { env } from "./config/env.js";
import authenticatePlugin from "./plugins/authenticate.js";
import csrfPlugin from "./plugins/csrf.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerV1Routes } from "./routes/v1/index.js";
import { registerWebSocketRoute } from "./routes/ws.js";

const loggerOptions =
  env.NODE_ENV === "test"
    ? { level: "silent" }
    : env.NODE_ENV === "development"
      ? {
          level: env.LOG_LEVEL,
          transport: { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
        }
      : { level: env.LOG_LEVEL };

export function buildApp() {
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // OpenAPI docs are generated straight from each route's Zod schemas — no
  // hand-maintained spec to drift out of sync. UI is dev-only; the API
  // surface isn't something we want discoverable by an anonymous prod caller.
  if (env.NODE_ENV !== "production") {
    app.register(swagger, {
      openapi: {
        info: { title: "SOC Platform API", version: "v1" },
        servers: [{ url: `http://${env.HOST}:${env.PORT}` }],
      },
      transform: jsonSchemaTransform,
    });
    app.register(swaggerUi, { routePrefix: "/docs" });
  }

  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
      },
    },
  });

  app.register(cors, {
    origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  });

  // Rate limiting is skipped only in tests (which log in far more often, in a
  // tight loop, than any real client would) — dev and prod always enforce it.
  if (env.NODE_ENV !== "test") {
    app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute",
    });
  }

  app.register(cookie);
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024, files: 1 } });
  app.register(websocket);
  app.register(authenticatePlugin);
  app.register(csrfPlugin);

  app.register(registerHealthRoutes);
  app.register(registerAuthRoutes, { prefix: "/api/v1/auth" });
  app.register(registerV1Routes, { prefix: "/api/v1" });
  app.register(registerWebSocketRoute);

  app.setErrorHandler((error: FastifyError | ZodError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        status: "fail",
        message: "Validation failed",
        errors: error.flatten().fieldErrors,
      });
    }

    request.log.error({ err: error }, "unhandled request error");

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      status: "error",
      message: statusCode >= 500 && env.NODE_ENV === "production" ? "Internal Server Error" : error.message,
    });
  });

  return app;
}

export type TypedApp = ReturnType<typeof buildApp>;

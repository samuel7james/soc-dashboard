import { prisma } from "@soc/database";
import { z } from "zod";

import { cached } from "../../lib/redis.js";
import { requireAuth } from "../../plugins/rbac.js";
import type { TypedApp } from "../../app.js";

const MITRE_CACHE_KEY = "mitre:techniques:all";
const MITRE_CACHE_TTL_SECONDS = 60 * 60; // reference data, changes only via re-seeding

export async function registerMitreRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/",
    {
      preHandler: requireAuth,
      schema: { querystring: z.object({ tactic: z.string().optional() }) },
    },
    async (request) => {
      const techniques = await cached(MITRE_CACHE_KEY, MITRE_CACHE_TTL_SECONDS, () =>
        prisma.mitreTechnique.findMany({ orderBy: { id: "asc" } }),
      );

      const { tactic } = request.query;
      return { items: tactic ? techniques.filter((t) => t.tactic === tactic) : techniques };
    },
  );
}

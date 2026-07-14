import { prisma } from "@soc/database";
import { z } from "zod";

import { requireAuth } from "../../plugins/rbac.js";
import type { TypedApp } from "../../app.js";

const EXPORTABLE_RESOURCES = ["alerts", "incidents", "vulnerabilities", "assets"] as const;

const exportQuerySchema = z.object({
  resource: z.enum(EXPORTABLE_RESOURCES),
  format: z.enum(["csv", "json"]).default("csv"),
});

async function loadRows(resource: (typeof EXPORTABLE_RESOURCES)[number]): Promise<Record<string, unknown>[]> {
  switch (resource) {
    case "alerts":
      return prisma.alert.findMany({ orderBy: { createdAt: "desc" } });
    case "incidents":
      return prisma.incident.findMany({ orderBy: { createdAt: "desc" } });
    case "vulnerabilities":
      return prisma.vulnerability.findMany({ orderBy: { createdAt: "desc" } });
    case "assets":
      return prisma.asset.findMany({ orderBy: { createdAt: "desc" } });
  }
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const str = value instanceof Date ? value.toISOString() : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(row[col])).join(","));
  }
  return lines.join("\n");
}

export async function registerReportRoutes(app: TypedApp): Promise<void> {
  // Real, on-demand export rather than a speculative persisted Report entity
  // with background generation — that lands once there's an actual scheduling
  // requirement driving it, per PROJECT_PLAN's "don't build ahead of need."
  app.get(
    "/export",
    { preHandler: requireAuth, schema: { querystring: exportQuerySchema } },
    async (request, reply) => {
      const { resource, format } = request.query;
      const rows = await loadRows(resource);

      if (format === "json") {
        return rows;
      }

      reply.header("Content-Type", "text/csv");
      reply.header("Content-Disposition", `attachment; filename="${resource}.csv"`);
      return toCsv(rows);
    },
  );
}

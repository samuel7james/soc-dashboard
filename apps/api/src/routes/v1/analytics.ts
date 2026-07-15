import type { Severity } from "@soc/types";
import { analyticsRangeQuerySchema, timelineQuerySchema } from "@soc/types";
import { prisma } from "@soc/database";

import { requireAuth } from "../../plugins/rbac.js";
import type { TypedApp } from "../../app.js";

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

// Deterministic, explainable risk formula — not a fake/random score. Points
// come from open vulnerabilities and unresolved alerts on the asset (by
// severity), then scaled by the asset's own declared criticality so a
// critical server accumulates risk faster than an equally-affected low-value
// workstation. Capped at 100 so the UI can render it as a simple 0-100 gauge.
const VULN_POINTS: Record<Severity, number> = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
const ALERT_POINTS: Record<Severity, number> = { critical: 20, high: 12, medium: 6, low: 2, info: 1 };
const CRITICALITY_MULTIPLIER: Record<Severity, number> = {
  critical: 1.3,
  high: 1.15,
  medium: 1.0,
  low: 0.85,
  info: 0.7,
};

interface TrendRow {
  day: Date;
  severity: Severity;
  count: bigint;
}

interface HeatmapRow {
  day_of_week: number;
  hour: number;
  count: bigint;
}

export async function registerAnalyticsRoutes(app: TypedApp): Promise<void> {
  app.get(
    "/alerts-trend",
    { preHandler: requireAuth, schema: { querystring: analyticsRangeQuerySchema } },
    async (request) => {
      const { days } = request.query;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await prisma.$queryRaw<TrendRow[]>`
        SELECT date_trunc('day', "createdAt") AS day, severity, COUNT(*)::bigint AS count
        FROM alerts
        WHERE "createdAt" >= ${since}
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `;

      const byDay = new Map<string, Record<Severity, number>>();
      for (const row of rows) {
        const key = row.day.toISOString().slice(0, 10);
        const bucket = byDay.get(key) ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        bucket[row.severity] = Number(row.count);
        byDay.set(key, bucket);
      }

      const points = [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, bucket]) => ({
          date,
          ...bucket,
          total: SEVERITIES.reduce((sum, s) => sum + bucket[s], 0),
        }));

      return { items: points };
    },
  );

  app.get(
    "/heatmap",
    { preHandler: requireAuth, schema: { querystring: analyticsRangeQuerySchema } },
    async (request) => {
      const { days } = request.query;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const rows = await prisma.$queryRaw<HeatmapRow[]>`
        SELECT
          EXTRACT(DOW FROM "createdAt")::int AS day_of_week,
          EXTRACT(HOUR FROM "createdAt")::int AS hour,
          COUNT(*)::bigint AS count
        FROM alerts
        WHERE "createdAt" >= ${since}
        GROUP BY 1, 2
      `;

      const items = rows.map((r) => ({ dayOfWeek: r.day_of_week, hour: r.hour, count: Number(r.count) }));
      return { items };
    },
  );

  app.get("/mitre-frequency", { preHandler: requireAuth }, async () => {
    const mappings = await prisma.alertMitreMapping.groupBy({
      by: ["mitreTechniqueId"],
      _count: { alertId: true },
    });

    if (mappings.length === 0) return { items: [] };

    const techniques = await prisma.mitreTechnique.findMany({
      where: { id: { in: mappings.map((m) => m.mitreTechniqueId) } },
    });
    const byId = new Map(techniques.map((t) => [t.id, t]));

    const items = mappings
      .map((m) => {
        const technique = byId.get(m.mitreTechniqueId);
        return {
          techniqueId: m.mitreTechniqueId,
          name: technique?.name ?? m.mitreTechniqueId,
          tactic: technique?.tactic ?? "unknown",
          count: m._count.alertId,
        };
      })
      .sort((a, b) => b.count - a.count);

    return { items };
  });

  // "Detection effectiveness" honestly reflects this platform's actual
  // architecture: rules are pattern-matchers in packages/connectors, not
  // persisted DB entities, so there is no rule_id to join against. Per-source
  // effectiveness (raw events in vs. alerts out) and per-rule effectiveness
  // (grouped by the alert title/severity a rule produces, since each rule
  // currently emits one fixed title) are both real aggregates over real data.
  app.get("/detection-effectiveness", { preHandler: requireAuth }, async () => {
    const [sources, rawEventCounts, alertCounts] = await Promise.all([
      prisma.ingestionSource.findMany(),
      prisma.rawEvent.groupBy({ by: ["ingestionSourceId"], _count: { id: true } }),
      prisma.alert.groupBy({
        by: ["ingestionSourceId"],
        _count: { id: true },
        where: { ingestionSourceId: { not: null } },
      }),
    ]);

    const rawCountBySource = new Map(rawEventCounts.map((r) => [r.ingestionSourceId, r._count.id]));
    const alertCountBySource = new Map(alertCounts.map((a) => [a.ingestionSourceId as string, a._count.id]));

    const bySource = sources
      .map((source) => {
        const rawEventCount = rawCountBySource.get(source.id) ?? 0;
        const alertCount = alertCountBySource.get(source.id) ?? 0;
        return {
          sourceId: source.id,
          sourceName: source.name,
          sourceType: source.type,
          rawEventCount,
          alertCount,
          alertRate: rawEventCount > 0 ? Math.round((alertCount / rawEventCount) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.rawEventCount - a.rawEventCount);

    const ruleGroups = await prisma.alert.groupBy({
      by: ["title", "severity"],
      _count: { id: true },
      where: { ingestionSourceId: { not: null } },
    });

    // One sample alert per (title, severity) group in a single query — this
    // used to be a Promise.all of one findFirst per group (N+1: parallelized,
    // so not slow in practice, but still N round trips that `distinct` does
    // in one).
    const samples = await prisma.alert.findMany({
      where: { ingestionSourceId: { not: null } },
      distinct: ["title", "severity"],
      include: { mitreMappings: true },
    });
    const sampleByGroup = new Map(samples.map((s) => [JSON.stringify([s.title, s.severity]), s]));

    const byRule = ruleGroups
      .sort((a, b) => b._count.id - a._count.id)
      .map((group) => {
        const sample = sampleByGroup.get(JSON.stringify([group.title, group.severity]));
        return {
          title: group.title,
          severity: group.severity,
          mitreTechniqueIds: sample?.mitreMappings.map((m) => m.mitreTechniqueId) ?? [],
          count: group._count.id,
        };
      });

    return { bySource, byRule };
  });

  app.get("/asset-risk", { preHandler: requireAuth }, async () => {
    const assets = await prisma.asset.findMany({
      include: {
        vulnerabilities: { where: { status: "open" }, select: { severity: true } },
        alerts: { where: { status: { in: ["open", "acknowledged"] } }, select: { severity: true } },
      },
    });

    const items = assets
      .map((asset) => {
        const openVulnerabilities = asset.vulnerabilities.length;
        const criticalVulnerabilities = asset.vulnerabilities.filter((v) => v.severity === "critical").length;
        const openAlerts = asset.alerts.length;
        const criticalAlerts = asset.alerts.filter((a) => a.severity === "critical").length;

        const vulnPoints = asset.vulnerabilities.reduce((sum, v) => sum + VULN_POINTS[v.severity], 0);
        const alertPoints = asset.alerts.reduce((sum, a) => sum + ALERT_POINTS[a.severity], 0);
        const riskScore = Math.min(
          100,
          Math.round((vulnPoints + alertPoints) * CRITICALITY_MULTIPLIER[asset.criticality]),
        );

        return {
          assetId: asset.id,
          name: asset.name,
          type: asset.type,
          criticality: asset.criticality,
          openVulnerabilities,
          criticalVulnerabilities,
          openAlerts,
          criticalAlerts,
          riskScore,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);

    return { items };
  });

  app.get(
    "/timeline",
    { preHandler: requireAuth, schema: { querystring: timelineQuerySchema } },
    async (request) => {
      const { days, limit } = request.query;
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [alerts, incidents] = await Promise.all([
        prisma.alert.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: limit,
          include: { mitreMappings: true },
        }),
        prisma.incident.findMany({
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
      ]);

      const events = [
        ...alerts.map((a) => ({
          id: a.id,
          kind: "alert" as const,
          title: a.title,
          severity: a.severity,
          status: a.status,
          occurredAt: a.createdAt.toISOString(),
          mitreTechniqueIds: a.mitreMappings.map((m) => m.mitreTechniqueId),
        })),
        ...incidents.map((i) => ({
          id: i.id,
          kind: "incident" as const,
          title: i.title,
          severity: i.severity,
          status: i.status,
          occurredAt: i.createdAt.toISOString(),
          mitreTechniqueIds: [] as string[],
        })),
      ]
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, limit);

      return { items: events };
    },
  );
}

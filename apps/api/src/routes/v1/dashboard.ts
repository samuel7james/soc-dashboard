import { prisma } from "@soc/database";

import { requireAuth } from "../../plugins/rbac.js";
import type { TypedApp } from "../../app.js";

export async function registerDashboardRoutes(app: TypedApp): Promise<void> {
  app.get("/summary", { preHandler: requireAuth }, async () => {
    const [
      alertsTotal,
      alertsOpen,
      alertsCritical,
      alertsHigh,
      alertsMedium,
      alertsLow,
      incidentsTotal,
      incidentsOpen,
      incidentsInvestigating,
      vulnerabilitiesTotal,
      vulnerabilitiesOpen,
      vulnerabilitiesCritical,
      assetsTotal,
      recentAlerts,
    ] = await Promise.all([
      prisma.alert.count(),
      prisma.alert.count({ where: { status: "open" } }),
      prisma.alert.count({ where: { severity: "critical" } }),
      prisma.alert.count({ where: { severity: "high" } }),
      prisma.alert.count({ where: { severity: "medium" } }),
      prisma.alert.count({ where: { severity: "low" } }),
      prisma.incident.count(),
      prisma.incident.count({ where: { status: "open" } }),
      prisma.incident.count({ where: { status: "investigating" } }),
      prisma.vulnerability.count(),
      prisma.vulnerability.count({ where: { status: "open" } }),
      prisma.vulnerability.count({ where: { status: "open", severity: "critical" } }),
      prisma.asset.count(),
      prisma.alert.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { mitreMappings: true },
      }),
    ]);

    return {
      alerts: {
        total: alertsTotal,
        open: alertsOpen,
        critical: alertsCritical,
        high: alertsHigh,
        medium: alertsMedium,
        low: alertsLow,
      },
      incidents: { total: incidentsTotal, open: incidentsOpen, investigating: incidentsInvestigating },
      vulnerabilities: {
        total: vulnerabilitiesTotal,
        open: vulnerabilitiesOpen,
        critical: vulnerabilitiesCritical,
      },
      assets: { total: assetsTotal },
      recentAlerts: recentAlerts.map(({ mitreMappings, ...alert }) => ({
        ...alert,
        mitreTechniqueIds: mitreMappings.map((m) => m.mitreTechniqueId),
      })),
    };
  });
}

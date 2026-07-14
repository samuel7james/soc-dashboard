import { registerAlertRoutes } from "./alerts.js";
import { registerAnalyticsRoutes } from "./analytics.js";
import { registerAssetRoutes } from "./assets.js";
import { registerAuditLogRoutes } from "./audit-logs.js";
import { registerDashboardRoutes } from "./dashboard.js";
import { registerHuntingRoutes } from "./hunting.js";
import { registerIncidentRoutes } from "./incidents.js";
import { registerIngestRoutes } from "./ingest.js";
import { registerIocRoutes } from "./iocs.js";
import { registerMitreRoutes } from "./mitre.js";
import { registerNotificationRoutes } from "./notifications.js";
import { registerReportRoutes } from "./reports.js";
import { registerUserRoutes } from "./users.js";
import { registerVulnerabilityRoutes } from "./vulnerabilities.js";
import type { TypedApp } from "../../app.js";

export async function registerV1Routes(app: TypedApp): Promise<void> {
  app.get("/", async () => ({
    name: "SOC Platform API",
    version: "v1",
  }));

  app.get("/csrf", async (request) => ({
    csrfToken: request.cookies.csrf_token,
  }));

  app.register(registerUserRoutes, { prefix: "/users" });
  app.register(registerAlertRoutes, { prefix: "/alerts" });
  app.register(registerIncidentRoutes, { prefix: "/incidents" });
  app.register(registerAssetRoutes, { prefix: "/assets" });
  app.register(registerVulnerabilityRoutes, { prefix: "/vulnerabilities" });
  app.register(registerIocRoutes, { prefix: "/iocs" });
  app.register(registerMitreRoutes, { prefix: "/mitre/techniques" });
  app.register(registerAuditLogRoutes, { prefix: "/audit-logs" });
  app.register(registerNotificationRoutes, { prefix: "/notifications" });
  app.register(registerDashboardRoutes, { prefix: "/dashboard" });
  app.register(registerAnalyticsRoutes, { prefix: "/analytics" });
  app.register(registerHuntingRoutes, { prefix: "/hunting" });
  app.register(registerReportRoutes, { prefix: "/reports" });
  app.register(registerIngestRoutes, { prefix: "/ingest" });
}

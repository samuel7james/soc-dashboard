import { registerAlertRoutes } from "./alerts.js";
import { registerAssetRoutes } from "./assets.js";
import { registerIncidentRoutes } from "./incidents.js";
import { registerIocRoutes } from "./iocs.js";
import { registerMitreRoutes } from "./mitre.js";
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
}

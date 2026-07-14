import type { Alert, CreateAlertInput, UpdateAlertInput } from "@soc/types";

import { createResourceHooks } from "./resource";

export const alertHooks = createResourceHooks<Alert, CreateAlertInput, UpdateAlertInput>(
  "/api/v1/alerts",
  "alerts",
);

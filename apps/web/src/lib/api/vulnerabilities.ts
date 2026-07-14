import type { CreateVulnerabilityInput, UpdateVulnerabilityInput, Vulnerability } from "@soc/types";

import { createResourceHooks } from "./resource";

export const vulnerabilityHooks = createResourceHooks<
  Vulnerability,
  CreateVulnerabilityInput,
  UpdateVulnerabilityInput
>("/api/v1/vulnerabilities", "vulnerabilities");

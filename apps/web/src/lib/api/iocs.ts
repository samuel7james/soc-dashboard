import type { CreateIocInput, IOC, UpdateIocInput } from "@soc/types";

import { createResourceHooks } from "./resource";

export const iocHooks = createResourceHooks<IOC, CreateIocInput, UpdateIocInput>("/api/v1/iocs", "iocs");

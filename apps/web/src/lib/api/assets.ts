import type { Asset, CreateAssetInput, UpdateAssetInput } from "@soc/types";

import { createResourceHooks } from "./resource";

export const assetHooks = createResourceHooks<Asset, CreateAssetInput, UpdateAssetInput>(
  "/api/v1/assets",
  "assets",
);

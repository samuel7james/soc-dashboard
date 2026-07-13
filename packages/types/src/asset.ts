import { z } from "zod";

import { paginatedQuerySchema, sortOrderSchema } from "./common.js";
import { assetTypeSchema, severitySchema } from "./enums.js";

export const assetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: assetTypeSchema,
  ipAddress: z.string().nullable(),
  hostname: z.string().nullable(),
  criticality: severitySchema,
  owner: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Asset = z.infer<typeof assetSchema>;

export const createAssetSchema = z.object({
  name: z.string().min(1).max(200),
  type: assetTypeSchema,
  ipAddress: z.string().optional(),
  hostname: z.string().optional(),
  criticality: severitySchema.default("medium"),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = createAssetSchema.partial();
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

export const assetListQuerySchema = paginatedQuerySchema.extend({
  type: assetTypeSchema.optional(),
  criticality: severitySchema.optional(),
  sortBy: z.enum(["createdAt", "name", "criticality"]).default("createdAt"),
  sortOrder: sortOrderSchema.default("desc"),
});
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;

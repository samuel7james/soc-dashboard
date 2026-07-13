import { z } from "zod";

import { paginatedQuerySchema, sortOrderSchema } from "./common.js";
import { alertStatusSchema, severitySchema } from "./enums.js";

export const alertSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  severity: severitySchema,
  status: alertStatusSchema,
  sourceIp: z.string().nullable(),
  assetId: z.string().uuid().nullable(),
  assignedToId: z.string().uuid().nullable(),
  incidentId: z.string().uuid().nullable(),
  mitreTechniqueIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Alert = z.infer<typeof alertSchema>;

export const createAlertSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  severity: severitySchema,
  sourceIp: z.string().optional(),
  assetId: z.string().uuid().optional(),
  mitreTechniqueIds: z.array(z.string()).optional(),
});
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

export const updateAlertSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  severity: severitySchema.optional(),
  status: alertStatusSchema.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  incidentId: z.string().uuid().nullable().optional(),
  mitreTechniqueIds: z.array(z.string()).optional(),
});
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;

export const alertListQuerySchema = paginatedQuerySchema.extend({
  status: alertStatusSchema.optional(),
  severity: severitySchema.optional(),
  assetId: z.string().uuid().optional(),
  incidentId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "severity"]).default("createdAt"),
  sortOrder: sortOrderSchema.default("desc"),
});
export type AlertListQuery = z.infer<typeof alertListQuerySchema>;

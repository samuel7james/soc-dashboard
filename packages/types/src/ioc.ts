import { z } from "zod";

import { paginatedQuerySchema, sortOrderSchema } from "./common.js";
import { iocTypeSchema, severitySchema } from "./enums.js";

export const iocSchema = z.object({
  id: z.string().uuid(),
  type: iocTypeSchema,
  value: z.string(),
  severity: severitySchema,
  description: z.string().max(2000).nullable(),
  source: z.string().nullable(),
  threatActorId: z.string().uuid().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type IOC = z.infer<typeof iocSchema>;

export const createIocSchema = z.object({
  type: iocTypeSchema,
  value: z.string().min(1).max(500),
  severity: severitySchema.default("medium"),
  description: z.string().max(2000).optional(),
  source: z.string().optional(),
  threatActorId: z.string().uuid().optional(),
});
export type CreateIocInput = z.infer<typeof createIocSchema>;

export const updateIocSchema = createIocSchema.partial();
export type UpdateIocInput = z.infer<typeof updateIocSchema>;

export const iocListQuerySchema = paginatedQuerySchema.extend({
  type: iocTypeSchema.optional(),
  severity: severitySchema.optional(),
  sortBy: z.enum(["createdAt", "lastSeenAt", "severity"]).default("createdAt"),
  sortOrder: sortOrderSchema.default("desc"),
});
export type IocListQuery = z.infer<typeof iocListQuerySchema>;

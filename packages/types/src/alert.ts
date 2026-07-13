import { z } from "zod";

import { alertStatusSchema, severitySchema } from "./enums";

export const alertSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  severity: severitySchema,
  status: alertStatusSchema,
  sourceIp: z.string().ip().nullable(),
  assetId: z.string().uuid().nullable(),
  mitreTechniqueIds: z.array(z.string()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Alert = z.infer<typeof alertSchema>;

export const createAlertSchema = alertSchema.pick({
  title: true,
  description: true,
  severity: true,
  sourceIp: true,
  assetId: true,
  mitreTechniqueIds: true,
});
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

export const paginatedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PaginatedQuery = z.infer<typeof paginatedQuerySchema>;

export function paginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

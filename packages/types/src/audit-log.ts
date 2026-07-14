import { z } from "zod";

import { paginatedQuerySchema, sortOrderSchema } from "./common.js";

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  action: z.string(),
  targetType: z.string().nullable(),
  targetId: z.string().nullable(),
  ipAddress: z.string().nullable(),
  metadata: z.unknown().nullable(),
  createdAt: z.string(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditLogListQuerySchema = paginatedQuerySchema.extend({
  action: z.string().optional(),
  actorId: z.string().uuid().optional(),
  sortOrder: sortOrderSchema.default("desc"),
});
export type AuditLogListQuery = z.infer<typeof auditLogListQuerySchema>;

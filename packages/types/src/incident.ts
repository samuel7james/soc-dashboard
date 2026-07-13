import { z } from "zod";

import { paginatedQuerySchema, sortOrderSchema } from "./common.js";
import { incidentEventTypeSchema, incidentStatusSchema, severitySchema } from "./enums.js";

export const incidentSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).nullable(),
  severity: severitySchema,
  status: incidentStatusSchema,
  assignedToId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  closedAt: z.string().nullable(),
});
export type Incident = z.infer<typeof incidentSchema>;

export const createIncidentSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional(),
  severity: severitySchema,
  assignedToId: z.string().uuid().optional(),
  alertIds: z.array(z.string().uuid()).optional(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const updateIncidentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  severity: severitySchema.optional(),
  status: incidentStatusSchema.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
});
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>;

export const incidentListQuerySchema = paginatedQuerySchema.extend({
  status: incidentStatusSchema.optional(),
  severity: severitySchema.optional(),
  assignedToId: z.string().uuid().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "severity"]).default("createdAt"),
  sortOrder: sortOrderSchema.default("desc"),
});
export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;

export const incidentTimelineEventSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  authorId: z.string().uuid().nullable(),
  eventType: incidentEventTypeSchema,
  message: z.string(),
  createdAt: z.string(),
});
export type IncidentTimelineEvent = z.infer<typeof incidentTimelineEventSchema>;

export const createIncidentTimelineEventSchema = z.object({
  message: z.string().min(1).max(2000),
});
export type CreateIncidentTimelineEventInput = z.infer<typeof createIncidentTimelineEventSchema>;

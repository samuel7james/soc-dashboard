import { z } from "zod";

import { paginatedQuerySchema } from "./common.js";

export const rawEventSchema = z.object({
  id: z.string().uuid(),
  ingestionSourceId: z.string().uuid(),
  receivedAt: z.string(),
  sourceIp: z.string().nullable(),
  normalizedType: z.string().nullable(),
  payload: z.unknown(),
});
export type RawEvent = z.infer<typeof rawEventSchema>;

export const rawEventListQuerySchema = paginatedQuerySchema
  .extend({
    ingestionSourceId: z.string().uuid().optional(),
    sourceIp: z.string().optional(),
    normalizedType: z.string().optional(),
    since: z.string().optional(),
  })
  // Hunting queries scan through raw telemetry rather than triage a queue —
  // the frontend renders this via a virtualized table, so a much larger page
  // size than the shared 100-row cap is safe to request in one round trip.
  .extend({ pageSize: z.coerce.number().int().min(1).max(500).default(100) });
export type RawEventListQuery = z.infer<typeof rawEventListQuerySchema>;

export const ingestionSourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  isActive: z.boolean(),
  lastIngestedAt: z.string().nullable(),
  createdAt: z.string(),
});
export type IngestionSource = z.infer<typeof ingestionSourceSchema>;

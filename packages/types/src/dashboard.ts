import { z } from "zod";

import { alertSchema } from "./alert.js";

export const dashboardSummarySchema = z.object({
  alerts: z.object({
    total: z.number().int(),
    open: z.number().int(),
    critical: z.number().int(),
    high: z.number().int(),
    medium: z.number().int(),
    low: z.number().int(),
  }),
  incidents: z.object({
    total: z.number().int(),
    open: z.number().int(),
    investigating: z.number().int(),
  }),
  vulnerabilities: z.object({
    total: z.number().int(),
    open: z.number().int(),
    critical: z.number().int(),
  }),
  assets: z.object({
    total: z.number().int(),
  }),
  recentAlerts: z.array(alertSchema),
});
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;

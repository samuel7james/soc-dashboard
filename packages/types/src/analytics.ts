import { z } from "zod";

import { severitySchema } from "./enums.js";

export const analyticsRangeQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30),
});
export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;

export const alertsTrendPointSchema = z.object({
  date: z.string(),
  critical: z.number().int(),
  high: z.number().int(),
  medium: z.number().int(),
  low: z.number().int(),
  info: z.number().int(),
  total: z.number().int(),
});
export type AlertsTrendPoint = z.infer<typeof alertsTrendPointSchema>;

export const heatmapCellSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  hour: z.number().int().min(0).max(23),
  count: z.number().int(),
});
export type HeatmapCell = z.infer<typeof heatmapCellSchema>;

export const mitreFrequencyItemSchema = z.object({
  techniqueId: z.string(),
  name: z.string(),
  tactic: z.string(),
  count: z.number().int(),
});
export type MitreFrequencyItem = z.infer<typeof mitreFrequencyItemSchema>;

export const sourceEffectivenessItemSchema = z.object({
  sourceId: z.string().uuid(),
  sourceName: z.string(),
  sourceType: z.string(),
  rawEventCount: z.number().int(),
  alertCount: z.number().int(),
  alertRate: z.number(),
});
export type SourceEffectivenessItem = z.infer<typeof sourceEffectivenessItemSchema>;

export const ruleEffectivenessItemSchema = z.object({
  title: z.string(),
  severity: severitySchema,
  mitreTechniqueIds: z.array(z.string()),
  count: z.number().int(),
});
export type RuleEffectivenessItem = z.infer<typeof ruleEffectivenessItemSchema>;

export const detectionEffectivenessSchema = z.object({
  bySource: z.array(sourceEffectivenessItemSchema),
  byRule: z.array(ruleEffectivenessItemSchema),
});
export type DetectionEffectiveness = z.infer<typeof detectionEffectivenessSchema>;

export const assetRiskItemSchema = z.object({
  assetId: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  criticality: severitySchema,
  openVulnerabilities: z.number().int(),
  criticalVulnerabilities: z.number().int(),
  openAlerts: z.number().int(),
  criticalAlerts: z.number().int(),
  riskScore: z.number().int(),
});
export type AssetRiskItem = z.infer<typeof assetRiskItemSchema>;

export const timelineEventSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(["alert", "incident"]),
  title: z.string(),
  severity: severitySchema,
  status: z.string(),
  occurredAt: z.string(),
  mitreTechniqueIds: z.array(z.string()),
});
export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const timelineQuerySchema = analyticsRangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type TimelineQuery = z.infer<typeof timelineQuerySchema>;

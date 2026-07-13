import { z } from "zod";

export const severitySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof severitySchema>;

export const alertStatusSchema = z.enum(["open", "acknowledged", "resolved", "false_positive"]);
export type AlertStatus = z.infer<typeof alertStatusSchema>;

export const incidentStatusSchema = z.enum(["open", "investigating", "contained", "resolved", "closed"]);
export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const userRoleSchema = z.enum(["owner", "admin", "analyst", "read_only"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const ingestionSourceTypeSchema = z.enum(["demo_generator", "syslog", "file_upload", "webhook"]);
export type IngestionSourceType = z.infer<typeof ingestionSourceTypeSchema>;

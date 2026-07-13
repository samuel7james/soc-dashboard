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

export const assetTypeSchema = z.enum(["server", "workstation", "network_device", "cloud_resource", "other"]);
export type AssetType = z.infer<typeof assetTypeSchema>;

export const vulnerabilityStatusSchema = z.enum(["open", "remediated", "accepted_risk", "false_positive"]);
export type VulnerabilityStatus = z.infer<typeof vulnerabilityStatusSchema>;

export const iocTypeSchema = z.enum(["ip", "domain", "url", "file_hash", "email"]);
export type IocType = z.infer<typeof iocTypeSchema>;

export const incidentEventTypeSchema = z.enum(["note", "status_change", "assignment", "alert_linked"]);
export type IncidentEventType = z.infer<typeof incidentEventTypeSchema>;

export const notificationTypeSchema = z.enum(["alert", "incident", "system"]);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

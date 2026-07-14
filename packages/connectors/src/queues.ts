// Shared between apps/api (producer: file upload) and apps/worker (consumer +
// producer: syslog listener, Demo Mode). Both processes create their own
// BullMQ Queue/Worker instances against these names — this file only defines
// the contract between them, not a live connection.
export const INGESTION_QUEUE_NAME = "ingestion";
export const NOTIFICATION_DELIVERY_QUEUE_NAME = "notification-delivery";
export const SCHEDULED_REPORTS_QUEUE_NAME = "scheduled-reports";

export interface IngestionJobData {
  ingestionSourceId: string;
  normalizedType: string;
  sourceIp?: string;
  payload: Record<string, unknown>;
}

export interface NotificationDeliveryJobData {
  notificationId: string;
}

// Redis pub/sub channel used to fan live events (new alerts, new incidents)
// out to every API process's WebSocket clients. Alerts can be created either
// by the API (analyst-submitted) or by the worker (ingestion pipeline) — pub/
// sub is what lets either path reach connected browsers without the two
// processes needing a direct connection to each other.
export const REALTIME_CHANNEL = "soc:realtime";

export interface RealtimeEvent {
  type: "alert.created" | "incident.created";
  data: Record<string, unknown>;
}

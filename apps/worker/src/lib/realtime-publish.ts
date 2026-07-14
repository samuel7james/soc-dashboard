import { REALTIME_CHANNEL, type RealtimeEvent } from "@soc/connectors";

import { redisConnection } from "./redis-connection.js";

export async function publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
  try {
    await redisConnection.publish(REALTIME_CHANNEL, JSON.stringify(event));
  } catch {
    // Best-effort — a failed publish shouldn't fail ingestion processing.
  }
}

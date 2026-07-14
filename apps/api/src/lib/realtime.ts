import { REALTIME_CHANNEL, type RealtimeEvent } from "@soc/connectors";
import { Redis } from "ioredis";
import type { WebSocket } from "ws";

import { env } from "../config/env.js";

const clients = new Set<WebSocket>();

// Two connections: ioredis puts a connection in a dedicated mode once
// `.subscribe()` is called, so it can no longer run PUBLISH or anything else.
const subscriber = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;
const publisher = env.REDIS_URL ? new Redis(env.REDIS_URL) : null;

if (subscriber) {
  void subscriber.subscribe(REALTIME_CHANNEL).catch(() => {
    // Redis unreachable at boot — live push degrades to "nothing happens" rather than crashing the API.
  });

  subscriber.on("message", (_channel, message) => {
    for (const client of clients) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
  });
}

export function registerRealtimeClient(socket: WebSocket): void {
  clients.add(socket);
  socket.on("close", () => clients.delete(socket));
}

export async function publishRealtimeEvent(event: RealtimeEvent): Promise<void> {
  if (!publisher) return;
  try {
    await publisher.publish(REALTIME_CHANNEL, JSON.stringify(event));
  } catch {
    // Best-effort — a failed publish shouldn't fail the request that triggered it.
  }
}

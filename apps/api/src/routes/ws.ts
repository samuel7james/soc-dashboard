import type { TypedApp } from "../app.js";
import { registerRealtimeClient } from "../lib/realtime.js";

// Authenticated via the same access_token cookie as the REST API — the
// authenticate plugin's onRequest hook already ran by the time this handler
// fires, since Fastify runs the full hook chain for the WS upgrade request too.
export async function registerWebSocketRoute(app: TypedApp): Promise<void> {
  app.get("/ws", { websocket: true }, (socket, request) => {
    if (!request.user) {
      socket.close(4001, "Unauthorized");
      return;
    }
    registerRealtimeClient(socket);
  });
}

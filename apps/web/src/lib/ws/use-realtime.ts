"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

interface RealtimeEvent {
  type: "alert.created" | "incident.created";
  data: Record<string, unknown>;
}

function wsUrl(): string {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return apiBase.replace(/^http/, "ws") + "/ws";
}

// Cookie-authenticated (same-site as the REST API, so the access_token cookie
// rides along with the handshake automatically) — invalidates the relevant
// TanStack Query caches so open pages pick up new alerts/incidents without a
// manual refresh, whether they were created via the API or the ingestion worker.
export function useRealtimeUpdates(enabled: boolean): void {
  const queryClient = useQueryClient();
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByEffectCleanup = false;

    function connect(): void {
      socket = new WebSocket(wsUrl());

      socket.onopen = () => {
        reconnectAttempts.current = 0;
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const message = JSON.parse(event.data) as RealtimeEvent;
          if (message.type === "alert.created") {
            void queryClient.invalidateQueries({ queryKey: ["alerts"] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
            void queryClient.invalidateQueries({ queryKey: ["raw-events"] });
          } else if (message.type === "incident.created") {
            void queryClient.invalidateQueries({ queryKey: ["incidents"] });
            void queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        if (closedByEffectCleanup || reconnectAttempts.current >= 5) return;
        reconnectAttempts.current += 1;
        reconnectTimer = setTimeout(connect, 2000 * reconnectAttempts.current);
      };
    }

    connect();

    return () => {
      closedByEffectCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient, enabled]);
}

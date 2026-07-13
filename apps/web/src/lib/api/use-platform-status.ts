import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
}

export function usePlatformStatus() {
  return useQuery({
    queryKey: ["platform-status"],
    queryFn: () => apiFetch<HealthResponse>("/health"),
    refetchInterval: 15_000,
    retry: false,
  });
}

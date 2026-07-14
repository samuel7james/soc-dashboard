import type { AuditLog } from "@soc/types";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";
import type { PaginatedResponse } from "./resource";

export function useAuditLogs(query: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();

  return useQuery({
    queryKey: ["audit-logs", query],
    queryFn: () => apiFetch<PaginatedResponse<AuditLog>>(`/api/v1/audit-logs${qs ? `?${qs}` : ""}`),
    placeholderData: (previous) => previous,
  });
}

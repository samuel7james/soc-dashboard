import type { DashboardSummary } from "@soc/types";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch<DashboardSummary>("/api/v1/dashboard/summary"),
    refetchInterval: 30_000,
  });
}

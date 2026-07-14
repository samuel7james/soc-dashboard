import type { IngestionSource, RawEvent } from "@soc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch, apiUpload } from "./client";
import type { PaginatedResponse } from "./resource";

export function useRawEvents(query: Record<string, unknown> = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();

  return useQuery({
    queryKey: ["raw-events", query],
    queryFn: () => apiFetch<PaginatedResponse<RawEvent>>(`/api/v1/hunting/raw-events${qs ? `?${qs}` : ""}`),
    placeholderData: (previous) => previous,
    refetchInterval: 10_000,
  });
}

export function useIngestionSources() {
  return useQuery({
    queryKey: ["ingestion-sources"],
    queryFn: () => apiFetch<{ items: IngestionSource[] }>("/api/v1/hunting/sources"),
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useToggleIngestionSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiFetch<IngestionSource>(`/api/v1/hunting/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ingestion-sources"] }),
  });
}

export function useUploadTelemetryFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiUpload<{ status: string; queued: number; ingestionSourceId: string }>(
        "/api/v1/ingest/upload",
        formData,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["raw-events"] });
      void queryClient.invalidateQueries({ queryKey: ["ingestion-sources"] });
    },
  });
}

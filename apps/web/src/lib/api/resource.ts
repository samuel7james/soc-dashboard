import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

function buildQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// One factory instead of six near-identical hook files — every SOC entity
// (alerts, incidents, assets, vulnerabilities, IOCs) follows the same
// list/detail/create/update/delete shape against the REST API.
export function createResourceHooks<TItem, TCreate = Partial<TItem>, TUpdate = Partial<TItem>>(
  resourcePath: string,
  queryKey: string,
) {
  function useList(query: Record<string, unknown> = {}) {
    return useQuery({
      queryKey: [queryKey, "list", query],
      queryFn: () => apiFetch<PaginatedResponse<TItem>>(`${resourcePath}${buildQueryString(query)}`),
      placeholderData: (previous) => previous,
    });
  }

  function useDetail(id: string | undefined) {
    return useQuery({
      queryKey: [queryKey, "detail", id],
      queryFn: () => apiFetch<TItem>(`${resourcePath}/${id}`),
      enabled: Boolean(id),
    });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (input: TCreate) =>
        apiFetch<TItem>(resourcePath, { method: "POST", body: JSON.stringify(input) }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: TUpdate }) =>
        apiFetch<TItem>(`${resourcePath}/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  }

  function useDelete() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => apiFetch<void>(`${resourcePath}/${id}`, { method: "DELETE" }),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });
  }

  return { useList, useDetail, useCreate, useUpdate, useDelete };
}

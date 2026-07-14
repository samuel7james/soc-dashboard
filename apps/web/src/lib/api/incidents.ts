import type {
  Alert,
  CreateIncidentInput,
  CreateIncidentTimelineEventInput,
  Incident,
  IncidentTimelineEvent,
  UpdateIncidentInput,
} from "@soc/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "./client";
import { createResourceHooks } from "./resource";

export const incidentHooks = createResourceHooks<Incident, CreateIncidentInput, UpdateIncidentInput>(
  "/api/v1/incidents",
  "incidents",
);

export type IncidentDetail = Incident & { alerts: Alert[]; timelineEvents: IncidentTimelineEvent[] };

export function useIncidentDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["incidents", "detail", id],
    queryFn: () => apiFetch<IncidentDetail>(`/api/v1/incidents/${id}`),
    enabled: Boolean(id),
  });
}

export function useAddIncidentTimelineEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateIncidentTimelineEventInput }) =>
      apiFetch<IncidentTimelineEvent>(`/api/v1/incidents/${id}/timeline`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ["incidents", "detail", id] });
    },
  });
}

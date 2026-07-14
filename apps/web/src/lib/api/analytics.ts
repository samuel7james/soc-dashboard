import type {
  AlertsTrendPoint,
  AssetRiskItem,
  DetectionEffectiveness,
  HeatmapCell,
  MitreFrequencyItem,
  TimelineEvent,
} from "@soc/types";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "./client";

export function useAlertsTrend(days: number) {
  return useQuery({
    queryKey: ["analytics-alerts-trend", days],
    queryFn: () => apiFetch<{ items: AlertsTrendPoint[] }>(`/api/v1/analytics/alerts-trend?days=${days}`),
  });
}

export function useAlertsHeatmap(days: number) {
  return useQuery({
    queryKey: ["analytics-heatmap", days],
    queryFn: () => apiFetch<{ items: HeatmapCell[] }>(`/api/v1/analytics/heatmap?days=${days}`),
  });
}

export function useMitreFrequency() {
  return useQuery({
    queryKey: ["analytics-mitre-frequency"],
    queryFn: () => apiFetch<{ items: MitreFrequencyItem[] }>("/api/v1/analytics/mitre-frequency"),
  });
}

export function useDetectionEffectiveness() {
  return useQuery({
    queryKey: ["analytics-detection-effectiveness"],
    queryFn: () => apiFetch<DetectionEffectiveness>("/api/v1/analytics/detection-effectiveness"),
  });
}

export function useAssetRisk() {
  return useQuery({
    queryKey: ["analytics-asset-risk"],
    queryFn: () => apiFetch<{ items: AssetRiskItem[] }>("/api/v1/analytics/asset-risk"),
  });
}

export function useAnalyticsTimeline(days: number, limit = 100) {
  return useQuery({
    queryKey: ["analytics-timeline", days, limit],
    queryFn: () =>
      apiFetch<{ items: TimelineEvent[] }>(`/api/v1/analytics/timeline?days=${days}&limit=${limit}`),
  });
}

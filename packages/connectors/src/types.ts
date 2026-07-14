export interface NormalizedEvent {
  sourceIp?: string;
  normalizedType: string;
  receivedAt: Date;
  payload: Record<string, unknown>;
}

export interface DetectionResult {
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  mitreTechniqueIds: string[];
}

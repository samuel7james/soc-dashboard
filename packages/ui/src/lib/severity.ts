import type { Severity } from "@soc/types";

// Centralized so every widget (alert list, incident view, dashboard cards) agrees
// on what "critical" looks like instead of re-deriving color classes per component.
export const severityBadgeClasses: Record<Severity, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  info: "bg-sky-500/15 text-sky-400 border-sky-500/30",
};

export const severityLabel: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

// Hex equivalents of the Tailwind -500 shades used above, for contexts (chart
// fills, SVG strokes) that need an actual color value rather than a class —
// kept in lockstep with severityBadgeClasses so a severity reads identically
// everywhere it appears.
export const severityChartColor: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#10b981",
  info: "#0ea5e9",
};

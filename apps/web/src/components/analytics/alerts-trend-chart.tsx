"use client";

import type { AlertsTrendPoint, Severity } from "@soc/types";
import { severityChartColor, severityLabel } from "@soc/ui";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipContent } from "@/components/shared/chart-tooltip";

// Stacking order: lowest severity at the bottom, critical on top (the visual
// "cap" a reader's eye lands on first). The legend reads the opposite way —
// most severe first — since that's the priority order an analyst scans in.
const SEVERITY_ORDER: Severity[] = ["info", "low", "medium", "high", "critical"];
const LEGEND_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TrendLegend() {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
      {LEGEND_ORDER.map((severity) => (
        <span key={severity} className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-3 rounded-full"
            style={{ backgroundColor: severityChartColor[severity] }}
          />
          <span className="text-muted-foreground">{severityLabel[severity]}</span>
        </span>
      ))}
    </div>
  );
}

export function AlertsTrendChart({ points }: { points: AlertsTrendPoint[] }) {
  const data = points.map((p) => ({ ...p, label: formatDateLabel(p.date) }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="label"
            stroke="var(--chart-axis)"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
          />
          <YAxis
            stroke="var(--chart-axis)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
          />
          <Tooltip
            content={<ChartTooltipContent />}
            cursor={{ stroke: "var(--chart-axis)", strokeWidth: 1 }}
          />
          {SEVERITY_ORDER.map((severity) => (
            <Area
              key={severity}
              type="monotone"
              dataKey={severity}
              name={severityLabel[severity]}
              stackId="severity"
              stroke={severityChartColor[severity]}
              fill={severityChartColor[severity]}
              fillOpacity={0.15}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      <TrendLegend />
    </div>
  );
}

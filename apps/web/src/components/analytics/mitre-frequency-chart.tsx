"use client";

import type { MitreFrequencyItem } from "@soc/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltipContent } from "@/components/shared/chart-tooltip";

// Single magnitude series (technique frequency) -> sequential hue, not the
// categorical palette. Horizontal bars so technique names stay readable.
export function MitreFrequencyChart({ items }: { items: MitreFrequencyItem[] }) {
  const data = items.slice(0, 10).map((item) => ({
    ...item,
    label: `${item.techniqueId} · ${item.name}`,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 32, left: 4, bottom: 4 }}
        barCategoryGap={10}
      >
        <CartesianGrid strokeDasharray="0" horizontal={false} stroke="var(--chart-grid)" />
        <XAxis
          type="number"
          stroke="var(--chart-axis)"
          fontSize={12}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          stroke="var(--chart-axis)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={220}
        />
        <Tooltip content={<ChartTooltipContent />} cursor={{ fill: "var(--muted)" }} />
        <Bar dataKey="count" name="Alerts" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill="var(--chart-sequential-550)" />
          ))}
          <LabelList dataKey="count" position="right" className="fill-foreground text-xs" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

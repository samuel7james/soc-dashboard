"use client";

import type { DetectionEffectiveness } from "@soc/types";
import { SeverityBadge } from "@soc/ui";
import type { ReactNode } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/query-states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Categorical identity (one bar per ingestion source) -> the fixed 8-slot
// hue order, never reassigned when the source list is filtered.
const CATEGORICAL = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export function DetectionEffectivenessPanel({ data }: { data: DetectionEffectiveness }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Alert conversion rate by source</CardTitle>
          <CardDescription>
            Share of raw telemetry that produced an alert, per ingestion source
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.bySource.length === 0 ? (
            <EmptyState message="No ingestion activity yet." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, data.bySource.length * 44)}>
              <BarChart
                data={data.bySource}
                layout="vertical"
                margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="0" horizontal={false} stroke="var(--chart-grid)" />
                <XAxis
                  type="number"
                  unit="%"
                  domain={[0, 100]}
                  stroke="var(--chart-axis)"
                  fontSize={12}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="sourceName"
                  stroke="var(--chart-axis)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <Tooltip
                  content={<ChartTooltipContent formatter={(v) => `${v}%`} />}
                  cursor={{ fill: "var(--muted)" }}
                />
                <Bar dataKey="alertRate" name="Alert rate" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {data.bySource.map((_, i) => (
                    <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />
                  ))}
                  <LabelList
                    dataKey="alertRate"
                    position="right"
                    formatter={(v?: ReactNode) => (v === undefined ? "" : `${v}%`)}
                    className="fill-foreground text-xs"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detection rule effectiveness</CardTitle>
          <CardDescription>Alerts produced per matched pattern, ingestion-sourced only</CardDescription>
        </CardHeader>
        <CardContent className="px-0 py-0">
          {data.byRule.length === 0 ? (
            <div className="px-5 py-4">
              <EmptyState message="No ingestion-produced alerts yet." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rule</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>MITRE</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.byRule.map((rule) => (
                  <TableRow key={`${rule.title}-${rule.severity}`}>
                    <TableCell className="max-w-56 truncate">{rule.title}</TableCell>
                    <TableCell>
                      <SeverityBadge severity={rule.severity} />
                    </TableCell>
                    <TableCell className="space-x-1">
                      {rule.mitreTechniqueIds.map((id) => (
                        <Badge key={id} variant="outline">
                          {id}
                        </Badge>
                      ))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{rule.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

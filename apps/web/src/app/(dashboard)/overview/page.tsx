"use client";

import { SeverityBadge } from "@soc/ui";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { ErrorState } from "@/components/shared/query-states";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/lib/api/dashboard";

function StatCard({
  title,
  value,
  description,
}: {
  title: string;
  value: number | string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-3xl font-semibold">{value}</CardContent>
    </Card>
  );
}

const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

export default function OverviewPage() {
  const { data, isPending, isError } = useDashboardSummary();

  return (
    <div>
      <PageHeader
        title="Security Overview"
        description="Executive summary of alerts, incidents, and system health."
      />

      {isError && <ErrorState message="Failed to load dashboard summary." />}

      {isPending && !isError && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Open Alerts"
              value={data.alerts.open}
              description={`${data.alerts.total} total`}
            />
            <StatCard
              title="Active Incidents"
              value={data.incidents.open + data.incidents.investigating}
              description={`${data.incidents.total} total`}
            />
            <StatCard title="Monitored Assets" value={data.assets.total} description="Across all types" />
            <StatCard
              title="Open Vulnerabilities"
              value={data.vulnerabilities.open}
              description={`${data.vulnerabilities.critical} critical`}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Alerts by severity</CardTitle>
                <CardDescription>Open and historical, all time</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {SEVERITY_ORDER.map((severity) => {
                  const count = data.alerts[severity];
                  const max = Math.max(
                    1,
                    data.alerts.critical,
                    data.alerts.high,
                    data.alerts.medium,
                    data.alerts.low,
                  );
                  return (
                    <div key={severity} className="flex items-center gap-3">
                      <SeverityBadge severity={severity} className="w-16 shrink-0 justify-center" />
                      <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground w-6 shrink-0 text-right text-sm tabular-nums">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Recent alerts</CardTitle>
                <CardDescription>The 5 most recently created alerts</CardDescription>
              </CardHeader>
              <CardContent className="divide-border/60 flex flex-col divide-y">
                {data.recentAlerts.length === 0 && (
                  <p className="text-muted-foreground py-4 text-sm">No alerts yet.</p>
                )}
                {data.recentAlerts.map((alert) => (
                  <Link
                    key={alert.id}
                    href="/alerts"
                    className="hover:text-foreground flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate">{alert.title}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <StatusBadge status={alert.status} />
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

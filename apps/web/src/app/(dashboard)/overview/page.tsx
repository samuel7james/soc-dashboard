import { SeverityBadge } from "@soc/ui";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";

const severityPreview = ["critical", "high", "medium", "low", "info"] as const;

export default function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Security Overview"
        description="Executive summary of alerts, incidents, and system health."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Open Alerts</CardTitle>
            <CardDescription>Awaiting real data — Phase 5</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Incidents</CardTitle>
            <CardDescription>Awaiting real data — Phase 5</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monitored Assets</CardTitle>
            <CardDescription>Awaiting real data — Phase 5</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Open Vulnerabilities</CardTitle>
            <CardDescription>Awaiting real data — Phase 5</CardDescription>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">—</CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Severity scale</CardTitle>
          <CardDescription>
            Shared design tokens from @soc/ui, used consistently across every list and card.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {severityPreview.map((severity) => (
            <SeverityBadge key={severity} severity={severity} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

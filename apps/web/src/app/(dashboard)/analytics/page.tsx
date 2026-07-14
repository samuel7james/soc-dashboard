"use client";

import { useState } from "react";

import { AlertsHeatmap } from "@/components/analytics/alerts-heatmap";
import { AlertsTrendChart } from "@/components/analytics/alerts-trend-chart";
import { AssetRiskPanel } from "@/components/analytics/asset-risk-panel";
import { AttackTimeline } from "@/components/analytics/attack-timeline";
import { DetectionEffectivenessPanel } from "@/components/analytics/detection-effectiveness-panel";
import { MitreFrequencyChart } from "@/components/analytics/mitre-frequency-chart";
import { PageHeader } from "@/components/layout/page-header";
import { DateRangeSelect } from "@/components/shared/date-range-select";
import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAlertsHeatmap,
  useAlertsTrend,
  useAnalyticsTimeline,
  useAssetRisk,
  useDetectionEffectiveness,
  useMitreFrequency,
} from "@/lib/api/analytics";

function TrendsTab() {
  const [days, setDays] = useState(30);
  const trend = useAlertsTrend(days);
  const heatmap = useAlertsHeatmap(days);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DateRangeSelect days={days} onChange={setDays} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Alert volume over time</CardTitle>
          <CardDescription>Daily alert counts stacked by severity</CardDescription>
        </CardHeader>
        <CardContent>
          {trend.isError && <ErrorState message="Failed to load alert trend." />}
          {trend.isPending && !trend.isError && <LoadingRows count={6} />}
          {trend.data && trend.data.items.length === 0 && (
            <EmptyState message="No alerts in this time range." />
          )}
          {trend.data && trend.data.items.length > 0 && <AlertsTrendChart points={trend.data.items} />}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Alert activity heatmap</CardTitle>
          <CardDescription>When alerts fire, by day of week and hour of day (UTC)</CardDescription>
        </CardHeader>
        <CardContent>
          {heatmap.isError && <ErrorState message="Failed to load heatmap." />}
          {heatmap.isPending && !heatmap.isError && <LoadingRows count={4} />}
          {heatmap.data && <AlertsHeatmap cells={heatmap.data.items} />}
        </CardContent>
      </Card>
    </div>
  );
}

function MitreTab() {
  const mitre = useMitreFrequency();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top MITRE ATT&CK techniques</CardTitle>
        <CardDescription>Ranked by number of alerts mapped to each technique, all time</CardDescription>
      </CardHeader>
      <CardContent>
        {mitre.isError && <ErrorState message="Failed to load MITRE frequency." />}
        {mitre.isPending && !mitre.isError && <LoadingRows count={6} />}
        {mitre.data && mitre.data.items.length === 0 && <EmptyState message="No MITRE-mapped alerts yet." />}
        {mitre.data && mitre.data.items.length > 0 && <MitreFrequencyChart items={mitre.data.items} />}
      </CardContent>
    </Card>
  );
}

function DetectionTab() {
  const effectiveness = useDetectionEffectiveness();

  if (effectiveness.isError) return <ErrorState message="Failed to load detection effectiveness." />;
  if (effectiveness.isPending) return <LoadingRows count={6} />;
  return <DetectionEffectivenessPanel data={effectiveness.data} />;
}

function AssetRiskTab() {
  const risk = useAssetRisk();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Asset risk scoring</CardTitle>
        <CardDescription>
          Deterministic score (0-100) from open vulnerabilities and unresolved alerts, scaled by declared
          asset criticality
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 py-0">
        {risk.isError && (
          <div className="px-5 py-4">
            <ErrorState message="Failed to load asset risk." />
          </div>
        )}
        {risk.isPending && !risk.isError && <LoadingRows count={6} />}
        {risk.data && <AssetRiskPanel items={risk.data.items} />}
      </CardContent>
    </Card>
  );
}

function TimelineTab() {
  const [days, setDays] = useState(30);
  const timeline = useAnalyticsTimeline(days, 100);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DateRangeSelect days={days} onChange={setDays} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Attack timeline</CardTitle>
          <CardDescription>Alerts and incidents merged into one chronological feed</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.isError && <ErrorState message="Failed to load timeline." />}
          {timeline.isPending && !timeline.isError && <LoadingRows count={6} />}
          {timeline.data && <AttackTimeline events={timeline.data.items} />}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Advanced Analytics"
        description="Trends, detection effectiveness, and risk analytics across the platform."
      />

      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="mitre">MITRE ATT&CK</TabsTrigger>
          <TabsTrigger value="detection">Detection Effectiveness</TabsTrigger>
          <TabsTrigger value="risk">Asset Risk</TabsTrigger>
          <TabsTrigger value="timeline">Attack Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="trends">
          <TrendsTab />
        </TabsContent>
        <TabsContent value="mitre">
          <MitreTab />
        </TabsContent>
        <TabsContent value="detection">
          <DetectionTab />
        </TabsContent>
        <TabsContent value="risk">
          <AssetRiskTab />
        </TabsContent>
        <TabsContent value="timeline">
          <TimelineTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

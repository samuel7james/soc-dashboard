"use client";

import type { AssetRiskItem } from "@soc/types";
import { SeverityBadge } from "@soc/ui";

import { EmptyState } from "@/components/shared/query-states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function riskTier(score: number): { color: string; track: string; label: string } {
  if (score >= 75) return { color: "#ef4444", track: "#ef444433", label: "Critical" };
  if (score >= 50) return { color: "#f97316", track: "#f9731633", label: "High" };
  if (score >= 25) return { color: "#f59e0b", track: "#f59e0b33", label: "Medium" };
  return { color: "#10b981", track: "#10b98133", label: "Low" };
}

function RiskMeter({ score }: { score: number }) {
  const tier = riskTier(score);
  return (
    <div className="flex items-center gap-2" title={`${tier.label} risk`}>
      <div className="h-1.5 w-24 overflow-hidden rounded-full" style={{ backgroundColor: tier.track }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: tier.color }} />
      </div>
      <span className="w-8 text-right text-xs font-semibold tabular-nums">{score}</span>
    </div>
  );
}

export function AssetRiskPanel({ items }: { items: AssetRiskItem[] }) {
  if (items.length === 0) {
    return <EmptyState message="No assets to score yet." />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Asset</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Criticality</TableHead>
          <TableHead>Open vulnerabilities</TableHead>
          <TableHead>Open alerts</TableHead>
          <TableHead>Risk score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((asset) => (
          <TableRow key={asset.assetId}>
            <TableCell className="font-medium">{asset.name}</TableCell>
            <TableCell className="text-muted-foreground">{asset.type}</TableCell>
            <TableCell>
              <SeverityBadge severity={asset.criticality} />
            </TableCell>
            <TableCell className="tabular-nums">
              {asset.openVulnerabilities}
              {asset.criticalVulnerabilities > 0 && (
                <span className="text-destructive ml-1 text-xs">({asset.criticalVulnerabilities} crit)</span>
              )}
            </TableCell>
            <TableCell className="tabular-nums">
              {asset.openAlerts}
              {asset.criticalAlerts > 0 && (
                <span className="text-destructive ml-1 text-xs">({asset.criticalAlerts} crit)</span>
              )}
            </TableCell>
            <TableCell>
              <RiskMeter score={asset.riskScore} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

"use client";

import type { TimelineEvent } from "@soc/types";
import { severityChartColor } from "@soc/ui";
import { ShieldAlert, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/query-states";

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AttackTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <EmptyState message="No alerts or incidents in this time range." />;
  }

  return (
    <ol className="relative space-y-4 pl-6">
      <div className="bg-border absolute bottom-1 left-[7px] top-1 w-px" aria-hidden />
      {events.map((event) => {
        const Icon = event.kind === "incident" ? ShieldAlert : AlertTriangle;
        return (
          <li key={event.id} className="relative">
            <span
              className="border-background absolute -left-6 top-1 size-3.5 rounded-full border-2"
              style={{ backgroundColor: severityChartColor[event.severity] }}
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-2">
              <Icon className="text-muted-foreground size-3.5 shrink-0" aria-hidden />
              <span className="text-sm font-medium">{event.title}</span>
              <Badge variant="outline" className="capitalize">
                {event.kind}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {event.status.replace("_", " ")}
              </Badge>
              {event.mitreTechniqueIds.map((id) => (
                <Badge key={id} variant="outline">
                  {id}
                </Badge>
              ))}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">{formatTimestamp(event.occurredAt)}</div>
          </li>
        );
      })}
    </ol>
  );
}

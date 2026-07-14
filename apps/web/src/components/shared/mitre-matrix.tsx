"use client";

import { useMemo } from "react";

import { EmptyState, ErrorState, LoadingRows } from "@/components/shared/query-states";
import { alertHooks } from "@/lib/api/alerts";
import { useMitreTechniques } from "@/lib/api/mitre";

// Official MITRE ATT&CK (Enterprise) tactic ordering — matches the kill-chain sequence.
const TACTIC_ORDER = [
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Command and Control",
  "Exfiltration",
  "Impact",
];

export function MitreMatrix() {
  const { data, isPending, isError } = useMitreTechniques();
  // pageSize=100 is a pragmatic approximation for counting alert->technique
  // linkage client-side while the dataset is small; a dedicated aggregate
  // endpoint would replace this once alert volume grows past one page.
  const { data: alertsData } = alertHooks.useList({ pageSize: 100 });

  const alertCountByTechnique = useMemo(() => {
    const counts = new Map<string, number>();
    for (const alert of alertsData?.items ?? []) {
      for (const techniqueId of alert.mitreTechniqueIds) {
        counts.set(techniqueId, (counts.get(techniqueId) ?? 0) + 1);
      }
    }
    return counts;
  }, [alertsData]);

  if (isError) return <ErrorState message="Failed to load MITRE ATT&CK techniques." />;
  if (isPending) return <LoadingRows />;
  if (!data || data.items.length === 0) return <EmptyState message="No techniques seeded yet." />;

  const tactics = TACTIC_ORDER.filter((tactic) => data.items.some((t) => t.tactic === tactic));

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-3 pb-2" style={{ minWidth: `${tactics.length * 180}px` }}>
        {tactics.map((tactic) => {
          const techniques = data.items.filter((t) => t.tactic === tactic);
          return (
            <div key={tactic} className="w-44 shrink-0">
              <p className="text-muted-foreground mb-2 truncate text-xs font-semibold" title={tactic}>
                {tactic}
              </p>
              <div className="flex flex-col gap-1.5">
                {techniques.map((technique) => {
                  const count = alertCountByTechnique.get(technique.id) ?? 0;
                  return (
                    <a
                      key={technique.id}
                      href={technique.url ?? undefined}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-xs transition-colors ${
                        count > 0
                          ? "border-primary/40 bg-primary/10 text-foreground hover:bg-primary/15"
                          : "border-border/60 bg-card text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="truncate">
                        {technique.id} {technique.name}
                      </span>
                      {count > 0 && (
                        <span className="bg-primary text-primary-foreground shrink-0 rounded-full px-1.5 text-[10px] font-medium">
                          {count}
                        </span>
                      )}
                    </a>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

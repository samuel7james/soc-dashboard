import type { Severity } from "@soc/types";

import { cn } from "../lib/cn";
import { severityBadgeClasses, severityLabel } from "../lib/severity";

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        severityBadgeClasses[severity],
        className,
      )}
    >
      {severityLabel[severity]}
    </span>
  );
}

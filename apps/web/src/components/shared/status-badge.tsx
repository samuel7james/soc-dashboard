import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CLASSES: Record<string, string> = {
  open: "bg-red-500/15 text-red-400 border-red-500/30",
  acknowledged: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  investigating: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  contained: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  remediated: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  closed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  false_positive: "bg-muted text-muted-foreground border-border",
  accepted_risk: "bg-muted text-muted-foreground border-border",
};

function toLabel(status: string): string {
  return status
    .split("_")
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(STATUS_CLASSES[status] ?? "border-border text-foreground", className)}
    >
      {toLabel(status)}
    </Badge>
  );
}

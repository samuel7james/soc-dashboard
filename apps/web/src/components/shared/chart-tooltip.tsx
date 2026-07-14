interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

// Shared recharts tooltip content: values lead (bold, high-contrast), series
// name follows (secondary text), each row keyed by a short line stroke in the
// series color rather than a filled box. Never used for scatter — bar/line/
// area contexts only.
export function ChartTooltipContent({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  formatter?: (value: number | string) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="border-border bg-popover text-popover-foreground min-w-36 rounded-md border px-3 py-2 text-xs shadow-md">
      {label !== undefined && <div className="text-muted-foreground mb-1.5 font-medium">{label}</div>}
      <div className="space-y-1">
        {payload.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.name}</span>
            </span>
            <span className="font-semibold tabular-nums">
              {item.value !== undefined ? (formatter ? formatter(item.value) : item.value) : "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

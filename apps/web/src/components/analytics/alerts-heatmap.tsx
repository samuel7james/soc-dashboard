"use client";

import type { HeatmapCell } from "@soc/types";
import { Fragment } from "react";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SEQUENTIAL_STEPS = [
  "var(--chart-sequential-100)",
  "var(--chart-sequential-250)",
  "var(--chart-sequential-400)",
  "var(--chart-sequential-550)",
  "var(--chart-sequential-700)",
];

function stepForRatio(ratio: number): string {
  if (ratio <= 0) return "var(--muted)";
  const index = Math.min(SEQUENTIAL_STEPS.length - 1, Math.floor(ratio * SEQUENTIAL_STEPS.length));
  return SEQUENTIAL_STEPS[index]!;
}

// A 7x24 sequential heatmap (one hue, light -> dark by magnitude). Color is
// never the only channel: every cell is a focusable button with the exact
// count in its aria-label/title, reachable identically by hover or keyboard.
export function AlertsHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const byKey = new Map(cells.map((c) => [`${c.dayOfWeek}-${c.hour}`, c.count]));
  const max = Math.max(1, ...cells.map((c) => c.count));

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid min-w-[640px] grid-cols-[auto_repeat(24,1fr)] gap-[2px]">
        <div />
        {Array.from({ length: 24 }, (_, hour) => (
          <div key={hour} className="text-muted-foreground pb-1 text-center text-[10px]">
            {hour % 3 === 0 ? hour : ""}
          </div>
        ))}
        {DAY_LABELS.map((dayLabel, dayOfWeek) => (
          <Fragment key={dayOfWeek}>
            <div className="text-muted-foreground flex items-center pr-2 text-xs">{dayLabel}</div>
            {Array.from({ length: 24 }, (_, hour) => {
              const count = byKey.get(`${dayOfWeek}-${hour}`) ?? 0;
              return (
                <button
                  key={`${dayOfWeek}-${hour}`}
                  type="button"
                  title={`${dayLabel} ${hour}:00 — ${count} alert${count === 1 ? "" : "s"}`}
                  aria-label={`${dayLabel} ${hour}:00, ${count} alerts`}
                  className="focus-visible:ring-ring size-4 rounded-[3px] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 sm:size-5"
                  style={{ backgroundColor: stepForRatio(count / max) }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="text-muted-foreground mt-3 flex items-center gap-1.5 text-xs">
        <span>Fewer</span>
        {["var(--muted)", ...SEQUENTIAL_STEPS].map((color, i) => (
          <span key={i} className="size-3 rounded-[2px]" style={{ backgroundColor: color }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}

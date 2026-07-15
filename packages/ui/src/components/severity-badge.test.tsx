import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SeverityBadge } from "./severity-badge";

describe("SeverityBadge", () => {
  it.each([
    ["critical", "Critical", "text-red-400"],
    ["high", "High", "text-orange-400"],
    ["medium", "Medium", "text-amber-400"],
    ["low", "Low", "text-emerald-400"],
    ["info", "Info", "text-sky-400"],
  ] as const)("renders the %s label and color class", (severity, label, colorClass) => {
    render(<SeverityBadge severity={severity} />);
    const badge = screen.getByText(label);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass(colorClass);
  });

  it("merges an extra className without dropping the base classes", () => {
    render(<SeverityBadge severity="high" className="ml-2" />);
    const badge = screen.getByText("High");
    expect(badge).toHaveClass("ml-2");
    expect(badge).toHaveClass("rounded-full");
  });
});

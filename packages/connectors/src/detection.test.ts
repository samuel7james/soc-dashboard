import { describe, expect, it } from "vitest";

import { evaluateDetectionRules } from "./detection";
import type { NormalizedEvent } from "./types";

function event(payload: Record<string, unknown>, sourceIp?: string): NormalizedEvent {
  return {
    normalizedType: "syslog",
    receivedAt: new Date(),
    payload,
    ...(sourceIp !== undefined ? { sourceIp } : {}),
  };
}

describe("evaluateDetectionRules", () => {
  it("flags a failed password message as a brute-force-pattern alert", () => {
    const result = evaluateDetectionRules(event({ message: "Failed password for root from 10.0.0.5" }, "10.0.0.5"));
    expect(result).not.toBeNull();
    expect(result?.severity).toBe("medium");
    expect(result?.mitreTechniqueIds).toContain("T1110");
  });

  it("flags a ransomware keyword as critical", () => {
    const result = evaluateDetectionRules(event({ message: "ransomware payload executed" }));
    expect(result?.severity).toBe("critical");
  });

  it("flags a sudo command as a low-severity privilege escalation note", () => {
    const result = evaluateDetectionRules(
      event({ message: "sudo: root : TTY=pts/0 ; COMMAND=/usr/bin/systemctl restart nginx" }),
    );
    expect(result?.severity).toBe("low");
  });

  it("returns null for benign telemetry", () => {
    const result = evaluateDetectionRules(event({ message: "system startup complete" }));
    expect(result).toBeNull();
  });
});

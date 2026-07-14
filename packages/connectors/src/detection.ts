import type { DetectionResult, NormalizedEvent } from "./types.js";

interface Rule {
  test: (event: NormalizedEvent, text: string) => boolean;
  build: (event: NormalizedEvent) => DetectionResult;
}

// Intentionally small and pattern-based — a real detection engine belongs in
// a later phase. This exists so ingested telemetry can produce real Alerts
// end-to-end (rather than only ever landing inert in RawEvent), and to give
// the syslog/file-upload connectors something honest to demonstrate.
const RULES: Rule[] = [
  {
    test: (_e, text) => /failed password|authentication failure|invalid user/i.test(text),
    build: (e) => ({
      title: "Failed authentication attempt detected",
      description: `Ingested telemetry matched a failed-authentication pattern${e.sourceIp ? ` from ${e.sourceIp}` : ""}.`,
      severity: "medium",
      mitreTechniqueIds: ["T1110"],
    }),
  },
  {
    test: (_e, text) => /sudo:.*COMMAND=/i.test(text),
    build: (e) => ({
      title: "Privileged command execution via sudo",
      description: `Ingested telemetry recorded a sudo command execution${e.sourceIp ? ` from ${e.sourceIp}` : ""}.`,
      severity: "low",
      mitreTechniqueIds: ["T1548"],
    }),
  },
  {
    test: (_e, text) => /ransomware|malware detected|trojan/i.test(text),
    build: (e) => ({
      title: "Malware indicator in ingested telemetry",
      description: `Ingested telemetry matched a known malware/ransomware keyword${e.sourceIp ? ` from ${e.sourceIp}` : ""}.`,
      severity: "critical",
      mitreTechniqueIds: ["T1486"],
    }),
  },
];

function eventToText(event: NormalizedEvent): string {
  return JSON.stringify(event.payload);
}

export function evaluateDetectionRules(event: NormalizedEvent): DetectionResult | null {
  const text = eventToText(event);
  for (const rule of RULES) {
    if (rule.test(event, text)) {
      return rule.build(event);
    }
  }
  return null;
}

import type { NormalizedEvent } from "./types.js";

const FACILITIES = [
  "kern",
  "user",
  "mail",
  "daemon",
  "auth",
  "syslog",
  "lpr",
  "news",
  "uucp",
  "clock",
  "authpriv",
  "ftp",
  "ntp",
  "logaudit",
  "logalert",
  "cron",
  "local0",
  "local1",
  "local2",
  "local3",
  "local4",
  "local5",
  "local6",
  "local7",
];

const SEVERITIES = ["emergency", "alert", "critical", "error", "warning", "notice", "informational", "debug"];

// RFC 3164 (BSD syslog): "<PRI>Mmm dd hh:mm:ss HOSTNAME TAG: MESSAGE"
// This is the format almost every real-world UDP syslog sender still emits.
const RFC3164_PATTERN = /^<(\d{1,3})>(\w{3}\s+\d{1,2}\s\d{2}:\d{2}:\d{2})\s(\S+)\s([^:]+):\s?(.*)$/;

export interface ParsedSyslogMessage {
  facility: string;
  severity: string;
  host: string;
  tag: string;
  message: string;
}

export function parseSyslogMessage(raw: string): ParsedSyslogMessage | null {
  const match = RFC3164_PATTERN.exec(raw.trim());
  if (!match) return null;

  const [, priRaw, , host, tag, message] = match;
  const pri = Number(priRaw);
  const facility = FACILITIES[Math.floor(pri / 8)] ?? "unknown";
  const severity = SEVERITIES[pri % 8] ?? "unknown";

  return { facility, severity, host: host!, tag: tag!.trim(), message: message ?? "" };
}

export function syslogToNormalizedEvent(raw: string, remoteAddress: string): NormalizedEvent | null {
  const parsed = parseSyslogMessage(raw);
  if (!parsed) return null;

  return {
    sourceIp: remoteAddress,
    normalizedType: "syslog",
    receivedAt: new Date(),
    payload: { ...parsed, raw },
  };
}

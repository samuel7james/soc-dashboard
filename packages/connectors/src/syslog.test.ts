import { describe, expect, it } from "vitest";

import { parseSyslogMessage, syslogToNormalizedEvent } from "./syslog";

describe("parseSyslogMessage", () => {
  it("parses a standard RFC3164 auth failure message", () => {
    const raw = "<34>Oct 11 22:14:15 mymachine su: 'su root' failed for lonvick on /dev/pts/8";
    const parsed = parseSyslogMessage(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.facility).toBe("auth");
    expect(parsed?.severity).toBe("critical");
    expect(parsed?.host).toBe("mymachine");
    expect(parsed?.tag).toBe("su");
    expect(parsed?.message).toBe("'su root' failed for lonvick on /dev/pts/8");
  });

  it("parses a sshd failed password message", () => {
    const raw = "<38>Jan  5 10:22:01 webserver sshd[1234]: Failed password for root from 10.0.0.5 port 51422 ssh2";
    const parsed = parseSyslogMessage(raw);

    expect(parsed).not.toBeNull();
    expect(parsed?.tag).toBe("sshd[1234]");
    expect(parsed?.message).toContain("Failed password for root");
  });

  it("returns null for a non-syslog string", () => {
    expect(parseSyslogMessage("this is not syslog")).toBeNull();
  });
});

describe("syslogToNormalizedEvent", () => {
  it("builds a normalized event carrying the source IP and raw payload", () => {
    const raw = "<34>Oct 11 22:14:15 mymachine su: failed for root";
    const event = syslogToNormalizedEvent(raw, "192.168.1.50");

    expect(event?.sourceIp).toBe("192.168.1.50");
    expect(event?.normalizedType).toBe("syslog");
    expect(event?.payload.raw).toBe(raw);
  });

  it("returns null when the message can't be parsed", () => {
    expect(syslogToNormalizedEvent("garbage", "10.0.0.1")).toBeNull();
  });
});

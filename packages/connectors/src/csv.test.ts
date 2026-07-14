import { describe, expect, it } from "vitest";

import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("parses a simple CSV into row objects keyed by header", () => {
    const rows = parseCsv("ip,user,status\n10.0.0.1,root,failed\n10.0.0.2,admin,success\n");
    expect(rows).toEqual([
      { ip: "10.0.0.1", user: "root", status: "failed" },
      { ip: "10.0.0.2", user: "admin", status: "success" },
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const rows = parseCsv('title,note\n"Alert, high priority","contains, a comma"\n');
    expect(rows).toEqual([{ title: "Alert, high priority", note: "contains, a comma" }]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    const rows = parseCsv('title\n"She said ""hello"""\n');
    expect(rows).toEqual([{ title: 'She said "hello"' }]);
  });

  it("handles CRLF line endings", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n3,4\r\n");
    expect(rows).toEqual([
      { a: "1", b: "2" },
      { a: "3", b: "4" },
    ]);
  });

  it("returns an empty array for header-only input", () => {
    expect(parseCsv("a,b,c\n")).toEqual([]);
  });
});

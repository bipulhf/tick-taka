import { describe, expect, test } from "bun:test";
import { readAudit } from "./audit-report";

const accepted = { "GHSA-aaaa": "build tooling only", "GHSA-bbbb": "dev only" };
const advisory = (id: string) => ({
  url: `https://github.com/advisories/${id}`,
  title: "Bad thing",
  severity: "high",
  vulnerable_versions: "<1.0.0",
});

// CQ-044: an audit that couldn't run must fail the check, not pass it.
describe("reading bun audit's output", () => {
  test("nothing on stdout (registry unreachable) means the audit didn't run", () => {
    const result = readAudit("", 1, accepted);
    expect(result.ran).toBe(false);
  });

  test("output that isn't a JSON object of advisories means the audit didn't run", () => {
    for (const output of ["ConnectionRefused", "[]", "null", '{"error":"rate limited"}'])
      expect(readAudit(output, 1, accepted).ran).toBe(false);
  });

  test("a failed exit with no advisories read means the audit didn't run", () => {
    expect(readAudit("{}", 1, accepted).ran).toBe(false);
  });

  test("a clean run reports nothing new, and lists accepted ids no longer seen", () => {
    expect(readAudit("{}", 0, accepted)).toEqual({
      ran: true,
      found: [],
      fresh: [],
      stale: ["GHSA-aaaa", "GHSA-bbbb"],
    });
  });

  test("advisories (bun exits 1) are split into accepted and new", () => {
    const output = JSON.stringify({
      braces: [advisory("GHSA-aaaa")],
      lodash: [advisory("GHSA-cccc")],
    });
    const result = readAudit(output, 1, accepted);
    if (!result.ran) throw new Error(result.reason);
    expect(result.found.map((f) => f.id)).toEqual(["GHSA-aaaa", "GHSA-cccc"]);
    expect(result.fresh.map((f) => `${f.name} ${f.id}`)).toEqual(["lodash GHSA-cccc"]);
    expect(result.stale).toEqual(["GHSA-bbbb"]);
  });
});

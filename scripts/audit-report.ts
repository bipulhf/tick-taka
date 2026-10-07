/** Reads what `bun audit --json` printed, against the accepted advisories. Pure, for tests. */

export interface Advisory {
  url: string;
  title: string;
  severity: string;
  vulnerable_versions: string;
}

export interface Finding {
  name: string;
  id: string;
  advisory: Advisory;
}

export type AuditResult =
  /** The audit didn't run (registry unreachable, rate limit, bun changed its output). */
  | { ran: false; reason: string }
  | {
      ran: true;
      found: Finding[];
      /** Not in the allow-list: these fail the check. */
      fresh: Finding[];
      /** Accepted but no longer reported: their allow-list entries can go. */
      stale: string[];
    };

const isAdvisory = (value: unknown): value is Advisory =>
  typeof value === "object" && value !== null && typeof (value as Advisory).url === "string";

/**
 * `output` is bun audit's stdout and `exitCode` its exit code. bun exits 1 both when
 * it finds advisories and when it can't reach the registry (then printing nothing to
 * stdout), so a non-zero exit counts as "didn't run" only when no advisory was read.
 */
export function readAudit(
  output: string,
  exitCode: number,
  accepted: Record<string, string>,
): AuditResult {
  const text = output.trim();
  if (!text) return { ran: false, reason: `bun audit printed nothing (exit code ${exitCode})` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ran: false, reason: `bun audit did not return JSON:\n${text.slice(0, 2000)}` };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
    return {
      ran: false,
      reason: `bun audit returned an unexpected shape:\n${text.slice(0, 2000)}`,
    };
  const found: Finding[] = [];
  for (const [name, advisories] of Object.entries(parsed)) {
    if (!Array.isArray(advisories) || !advisories.every(isAdvisory))
      return { ran: false, reason: `bun audit returned an unexpected shape for ${name}` };
    for (const advisory of advisories)
      found.push({ name, id: advisory.url.split("/").pop() || advisory.url, advisory });
  }
  if (exitCode !== 0 && found.length === 0)
    return { ran: false, reason: `bun audit failed (exit code ${exitCode}) and reported nothing` };
  const seen = new Set(found.map((entry) => entry.id));
  return {
    ran: true,
    found,
    fresh: found.filter((entry) => !(entry.id in accepted)),
    stale: Object.keys(accepted).filter((id) => !seen.has(id)),
  };
}

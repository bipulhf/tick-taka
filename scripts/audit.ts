/**
 * `bun audit`, failing only on advisories that aren't accepted in
 * scripts/audit-allowlist.json (GHSA id → why it is accepted). An accepted advisory
 * that no longer shows up is reported so its entry can be removed.
 *
 * Run with `bun run audit`. Exit 1 on a new advisory or when the audit can't run.
 */
import { readAudit } from "./audit-report";

const allowlistPath = new URL("./audit-allowlist.json", import.meta.url);
const accepted = (await Bun.file(allowlistPath).json()) as Record<string, string>;

const audit = Bun.spawn(["bun", "audit", "--json"], { stdout: "pipe", stderr: "inherit" });
const output = await new Response(audit.stdout).text();
const result = readAudit(output, await audit.exited, accepted);

if (!result.ran) {
  // Nothing was learned: no advisory can be called new, and none can be called gone.
  console.error(`::error::The audit didn't run, so nothing was checked. ${result.reason}`);
  process.exit(1);
}

for (const { name, id } of result.found.filter((entry) => entry.id in accepted))
  console.log(`accepted  ${id}  ${name}: ${accepted[id]}`);
for (const id of result.stale)
  console.log(
    `::notice::${id} is accepted in scripts/audit-allowlist.json but no longer reported; remove it.`,
  );
for (const { name, id, advisory } of result.fresh)
  console.log(
    `::error::New advisory ${id} (${advisory.severity}) in ${name} ${advisory.vulnerable_versions}: ${advisory.title} ${advisory.url}`,
  );

if (result.fresh.length > 0) {
  console.log(
    `\n${result.fresh.length} advisory(ies) not in scripts/audit-allowlist.json. Upgrade, or accept with a reason.`,
  );
  process.exit(1);
}
console.log(`\nNo new advisories (${result.found.length} accepted).`);

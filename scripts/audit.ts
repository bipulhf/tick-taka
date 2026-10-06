/**
 * `bun audit`, failing only on advisories that aren't accepted in
 * scripts/audit-allowlist.json (GHSA id → why it is accepted). An accepted advisory
 * that no longer shows up is reported so its entry can be removed.
 *
 * Run with `bun run audit`. Exit 1 on a new advisory or when the audit can't run.
 */

interface Advisory {
  url: string;
  title: string;
  severity: string;
  vulnerable_versions: string;
}

const allowlistPath = new URL("./audit-allowlist.json", import.meta.url);
const accepted = (await Bun.file(allowlistPath).json()) as Record<string, string>;

const audit = Bun.spawn(["bun", "audit", "--json"], { stdout: "pipe", stderr: "inherit" });
const output = await new Response(audit.stdout).text();
await audit.exited;

let report: Record<string, Advisory[]>;
try {
  report = JSON.parse(output || "{}") as Record<string, Advisory[]>;
} catch {
  console.error(`bun audit did not return JSON:\n${output.slice(0, 2000)}`);
  process.exit(1);
}

const idOf = (advisory: Advisory) => advisory.url.split("/").pop() ?? advisory.url;
const found = Object.entries(report).flatMap(([name, advisories]) =>
  advisories.map((advisory) => ({ name, id: idOf(advisory), advisory })),
);
const fresh = found.filter((entry) => !(entry.id in accepted));
const seen = new Set(found.map((entry) => entry.id));
const stale = Object.keys(accepted).filter((id) => !seen.has(id));

for (const { name, id } of found.filter((entry) => entry.id in accepted))
  console.log(`accepted  ${id}  ${name}: ${accepted[id]}`);
for (const id of stale)
  console.log(
    `::notice::${id} is accepted in scripts/audit-allowlist.json but no longer reported; remove it.`,
  );
for (const { name, id, advisory } of fresh)
  console.log(
    `::error::New advisory ${id} (${advisory.severity}) in ${name} ${advisory.vulnerable_versions}: ${advisory.title} ${advisory.url}`,
  );

if (fresh.length > 0) {
  console.log(
    `\n${fresh.length} advisory(ies) not in scripts/audit-allowlist.json. Upgrade, or accept with a reason.`,
  );
  process.exit(1);
}
console.log(`\nNo new advisories (${found.length} accepted).`);

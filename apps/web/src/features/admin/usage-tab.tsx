import { ErrorState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { BarList } from "../review/charts/bar-list";
import { useAdminUsage } from "./queries";

/** The main kinds shown per user; the panel shows every kind. */
const PER_USER = ["tasks", "habits", "time_entries", "transactions", "accounts", "goals"] as const;
const LABELS: Record<(typeof PER_USER)[number], string> = {
  tasks: "Tasks",
  habits: "Habits",
  time_entries: "Time",
  transactions: "Transactions",
  accounts: "Accounts",
  goals: "Goals",
};

/** What the app is used for, as counts: across everyone, and per person. */
export function UsageTab() {
  const { data, isPending, isError, refetch } = useAdminUsage();
  if (isPending) return <SkeletonRows rows={6} />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;
  const ranked = [...data.totals].sort((a, b) => b.last30Days - a.last30Days);
  return (
    <div className="flex flex-col gap-8">
      <p className="text-callout text-muted">
        Counts only, never what's in them. Updated{" "}
        {new Date(data.computedAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        ; refreshes at most once a minute.
      </p>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Section
          title="Most used, last 30 days"
          caption="New records of each kind, everyone together"
        >
          <div className="rounded-2xl bg-card p-4">
            <BarList
              label="New records in the last 30 days by kind"
              tone="sky"
              items={ranked
                .filter((k) => k.last30Days > 0)
                .map((k) => ({
                  key: k.kind,
                  label: k.label,
                  value: k.last30Days,
                  valueText: `${k.last30Days} new`,
                }))}
            />
            {ranked.every((k) => k.last30Days === 0) ? (
              <p className="text-callout text-muted">Nothing new in the last 30 days.</p>
            ) : null}
          </div>
        </Section>
        <Section
          title="Everything kept"
          caption="Live records of each kind, and how many people use it"
        >
          <div className="overflow-x-auto rounded-2xl bg-card">
            <table className="w-full text-callout">
              <thead className="text-caption text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 text-left font-semibold">Kind</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Last 30 days</th>
                  <th className="px-4 py-2.5 text-right font-semibold">People</th>
                </tr>
              </thead>
              <tbody>
                {data.totals.map((k) => (
                  <tr key={k.kind} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 font-semibold">{k.label}</td>
                    <td className="px-4 py-2 text-right tabular">{k.total}</td>
                    <td className="px-4 py-2 text-right tabular">{k.last30Days}</td>
                    <td className="px-4 py-2 text-right tabular">{k.users}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
      <Section title="Per person" caption="Main kinds, live records">
        <div className="overflow-x-auto rounded-2xl bg-card">
          <table className="w-full min-w-[640px] text-callout">
            <thead className="text-caption text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 text-left font-semibold">Person</th>
                {PER_USER.map((kind) => (
                  <th key={kind} className="px-4 py-2.5 text-right font-semibold">
                    {LABELS[kind]}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right font-semibold">New, 30 days</th>
              </tr>
            </thead>
            <tbody>
              {[...data.perUser]
                .sort((a, b) => b.last30Days - a.last30Days)
                .map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="max-w-64 truncate px-4 py-2 font-semibold">
                      {u.name ?? u.email}
                    </td>
                    {PER_USER.map((kind) => (
                      <td key={kind} className="px-4 py-2 text-right tabular">
                        {u.counts[kind]}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right tabular">{u.last30Days}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

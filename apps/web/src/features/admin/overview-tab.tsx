import { ErrorState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { ViewSkeleton } from "@/components/ui/skeleton";
import { formatMonth } from "@/lib/format";
import { ColumnChart } from "../review/charts/column-chart";
import { dollars, useAdminOverview } from "./queries";
import { Stat, StatRow } from "./stat";

const weekLabel = (ms: number) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Users, activity, sign-ups by week and AI cost by month. */
export function OverviewTab() {
  const { data, isError, refetch } = useAdminOverview();
  if (!data) return isError ? <ErrorState onRetry={() => void refetch()} /> : <ViewSkeleton />;
  const thisMonthAi = data.aiByMonth[data.aiByMonth.length - 1];
  return (
    <div className="flex flex-col gap-8">
      <StatRow>
        <Stat label="Users" value={data.users} hint={`${data.newLast30Days} new in 30 days`} />
        <Stat label="Active today" value={data.activeToday} />
        <Stat label="Active, 7 days" value={data.active7Days} />
        <Stat label="Active, 30 days" value={data.active30Days} />
        <Stat label="Signed-in devices" value={data.liveSessions} hint="Live sessions" />
        <Stat
          label="AI this month"
          value={dollars(thisMonthAi?.costMicros ?? 0)}
          hint={`${thisMonthAi?.calls ?? 0} calls`}
        />
      </StatRow>

      <div className="grid gap-7 xl:grid-cols-2">
        <Section
          title="Sign-ups"
          caption={`${data.newLast7Days} this week · sign-ups are ${data.signupMode === "invite" ? "invite-only" : "open"}`}
        >
          <div className="rounded-2xl bg-card p-4">
            <ColumnChart
              label="Sign-ups per week, last 12 weeks"
              categories={data.signupsByWeek.map((w, i) => ({
                key: String(w.weekEnding),
                label: `Week ending ${weekLabel(w.weekEnding)}`,
                tick: i % 3 === 2 ? weekLabel(w.weekEnding) : undefined,
              }))}
              series={[
                {
                  key: "signups",
                  name: "Sign-ups",
                  tone: "sky",
                  values: data.signupsByWeek.map((w) => w.count),
                },
              ]}
              formatValue={(n) => `${n} sign-up${n === 1 ? "" : "s"}`}
              formatAxis={(n) => String(Math.round(n))}
            />
          </div>
        </Section>
        <Section title="AI cost" caption="All users, last six months">
          <div className="rounded-2xl bg-card p-4">
            <ColumnChart
              label="AI cost per month, last six months"
              categories={data.aiByMonth.map((m) => ({
                key: m.month,
                label: formatMonth(m.month),
                tick: formatMonth(m.month).slice(0, 3),
              }))}
              series={[
                {
                  key: "cost",
                  name: "AI cost",
                  tone: "neutral",
                  values: data.aiByMonth.map((m) => m.costMicros),
                },
              ]}
              formatValue={dollars}
              formatAxis={(n) => `$${(n / 1_000_000).toFixed(n >= 1_000_000 ? 0 : 2)}`}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}

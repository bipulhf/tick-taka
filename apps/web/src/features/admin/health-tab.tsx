import { addDays } from "@tick-taka/shared/dates";
import { ErrorState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { ViewSkeleton } from "@/components/ui/skeleton";
import { useTodayDate } from "@/lib/use-today";
import { ColumnChart } from "../review/charts/column-chart";
import { ago, bytes, useAdminHealth } from "./queries";
import { Stat, StatRow } from "./stat";

function uptime(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} days ${hours % 24} h`;
}

const hourLabel = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** The server process, its disk, its traffic since start, and every user's backups. */
export function HealthTab() {
  const { data, isError, refetch } = useAdminHealth();
  const today = useTodayDate();
  if (!data) return isError ? <ErrorState onRetry={() => void refetch()} /> : <ViewSkeleton />;
  const r = data.requests;
  const errorRate = r.requests ? ((r.serverErrors / r.requests) * 100).toFixed(2) : "0";
  const usedDisk = data.disk ? data.disk.total - data.disk.free : 0;
  const stale = (date: string | null) => !date || date < addDays(today, -2);
  return (
    <div className="flex flex-col gap-8">
      <StatRow>
        <Stat label="Up for" value={uptime(data.uptimeMs)} hint={`since ${ago(data.startedAt)}`} />
        <Stat
          label="Memory"
          value={bytes(data.memory.rss)}
          hint={`heap ${bytes(data.memory.heapUsed)}`}
        />
        <Stat label="Requests" value={r.requests.toLocaleString("en-US")} hint="since start" />
        <Stat
          label="Server errors"
          value={r.serverErrors}
          hint={`${errorRate}% · ${r.clientErrors} refused (4xx)`}
          tone={r.serverErrors > 0 ? "coral" : undefined}
        />
        <Stat
          label="Response time"
          value={r.medianMs === null ? "–" : `${r.medianMs} ms`}
          hint={r.p95Ms === null ? undefined : `95% under ${r.p95Ms} ms`}
        />
        <Stat label="Open databases" value={data.openDatabases} hint={data.runtime} />
      </StatRow>

      <div className="grid gap-7 xl:grid-cols-2">
        <Section title="Requests, last 24 hours" caption="Since the last restart">
          <div className="rounded-2xl bg-card p-4">
            <ColumnChart
              label="Requests per hour, last 24 hours"
              categories={r.lastDay.map((b, i) => ({
                key: String(b.hour),
                label: `${hourLabel(b.hour)}: ${b.serverErrors} server errors`,
                tick: i % 4 === 0 ? hourLabel(b.hour) : undefined,
              }))}
              series={[
                {
                  key: "requests",
                  name: "Requests",
                  tone: "sky",
                  values: r.lastDay.map((b) => b.requests),
                },
                {
                  key: "errors",
                  name: "Server errors",
                  tone: "coral",
                  values: r.lastDay.map((b) => b.serverErrors),
                },
              ]}
              formatValue={(n) => n.toLocaleString("en-US")}
            />
          </div>
        </Section>
        <Section title="Storage">
          <div className="flex flex-col gap-4 rounded-2xl bg-card p-4">
            {data.disk ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between text-callout">
                  <span className="font-semibold">Disk</span>
                  <span className="text-muted tabular">
                    {bytes(usedDisk)} used of {bytes(data.disk.total)} · {bytes(data.disk.free)}{" "}
                    free
                  </span>
                </div>
                <ProgressBar
                  value={usedDisk / data.disk.total}
                  tone={data.disk.free / data.disk.total < 0.1 ? "coral" : "ink"}
                  label="Disk used"
                />
              </div>
            ) : null}
            <dl className="grid grid-cols-2 gap-2">
              {[
                ["User databases", data.sizes.userDatabases],
                ["Receipts", data.sizes.uploads],
                ["Backups", data.sizes.backups],
                ["Sign-in list", data.sizes.registry],
              ].map(([label, size]) => (
                <div key={label} className="rounded-xl bg-background px-3 py-2">
                  <dt className="text-caption font-normal text-muted">{label}</dt>
                  <dd className="text-body font-bold tabular">{bytes(size as number)}</dd>
                </div>
              ))}
            </dl>
            <p className="text-callout text-muted">
              {data.aiConfigured ? "AI is set up" : "AI isn't set up"} · nightly jobs{" "}
              {data.jobsEnabled ? "on" : "off"} · off-site backups{" "}
              {data.offsiteBackups ? "on" : "not set up"}
            </p>
          </div>
        </Section>
      </div>

      <Section title="Nightly backups" caption="The last day each account was backed up">
        <div className="overflow-hidden rounded-2xl bg-card">
          <ul className="divide-y divide-line">
            {data.backups.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-4 px-4 py-2.5 text-callout"
              >
                <span className="truncate font-semibold">{b.email}</span>
                <span
                  className={
                    data.jobsEnabled && stale(b.lastBackup) ? "text-coral-text" : "text-muted"
                  }
                >
                  {b.lastBackup ?? "Not yet"}
                  {stale(b.lastBackup) && data.jobsEnabled ? " · overdue" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>
    </div>
  );
}

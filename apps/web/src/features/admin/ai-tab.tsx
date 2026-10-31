import { useState } from "react";
import { ErrorState } from "@/components/ui/empty-state";
import { MonthStepper } from "@/components/ui/month-stepper";
import { Section } from "@/components/ui/section";
import { ViewSkeleton } from "@/components/ui/skeleton";
import { useThisMonth } from "@/lib/use-today";
import { BarList } from "../review/charts/bar-list";
import { FeedbackSection } from "./feedback-section";
import { dollars, useAdminAi } from "./queries";
import { Stat, StatRow } from "./stat";

const FEATURE_LABELS: Record<string, string> = {
  assistant: "Chat with Tiki",
  parse: "Smart quick-add",
  receipt: "Receipt scan",
  categorize: "Auto-categorise",
  planDay: "Plan my day",
  breakdown: "Break it down",
  weeklyReview: "Weekly coach",
  budgetSuggestions: "Budget suggestions",
  ask: "Ask about my data",
  transcribe: "Voice",
};

/** One month's AI bill: by person and by feature. */
export function AiTab() {
  const thisMonth = useThisMonth();
  const [month, setMonth] = useState(thisMonth);
  const { data, isError, refetch } = useAdminAi(month);
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthStepper month={month} onChange={setMonth} max={thisMonth} />
        {data ? (
          <p className="text-callout text-muted">
            {data.configured ? "AI is set up" : "AI isn't set up on the server"} · default cap{" "}
            {data.serverCapMicros === null ? "none" : `${dollars(data.serverCapMicros)} a month`}
          </p>
        ) : null}
      </div>
      {!data ? (
        isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <ViewSkeleton />
        )
      ) : (
        <>
          <StatRow>
            <Stat label="Cost" value={dollars(data.costMicros)} />
            <Stat label="Calls" value={data.calls} />
            <Stat label="People using AI" value={data.byUser.length} />
            <Stat label="Input tokens" value={data.inputTokens.toLocaleString("en-US")} />
            <Stat label="Output tokens" value={data.outputTokens.toLocaleString("en-US")} />
            <Stat
              label="Per call"
              value={data.calls ? dollars(Math.round(data.costMicros / data.calls)) : "–"}
            />
          </StatRow>
          <div className="grid gap-7 xl:grid-cols-2">
            <Section title="By person">
              <div className="rounded-2xl bg-card p-4">
                {data.byUser.length ? (
                  <BarList
                    label="AI cost by person"
                    tone="neutral"
                    items={data.byUser.map((u) => ({
                      key: u.id,
                      label: u.name ?? u.email,
                      value: u.costMicros,
                      valueText: `${dollars(u.costMicros)} · ${u.calls} calls`,
                    }))}
                  />
                ) : (
                  <p className="text-callout text-muted">No AI use this month.</p>
                )}
              </div>
            </Section>
            <Section title="By feature">
              <div className="rounded-2xl bg-card p-4">
                {data.byFeature.length ? (
                  <BarList
                    label="AI cost by feature"
                    tone="sky"
                    items={data.byFeature.map((f) => ({
                      key: f.feature,
                      label: FEATURE_LABELS[f.feature] ?? f.feature,
                      value: f.costMicros,
                      valueText: `${dollars(f.costMicros)} · ${f.calls} calls`,
                    }))}
                  />
                ) : (
                  <p className="text-callout text-muted">No AI use this month.</p>
                )}
              </div>
            </Section>
          </div>
          <FeedbackSection month={month} />
        </>
      )}
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { ProgressBar } from "@/components/ui/progress";
import { plural } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import type { TodayData } from "@/lib/queries";
import { FirstBudget } from "./first-budget";
import { safeToSpendLabel } from "./safe-to-spend-label";

const CARD =
  "group block rounded-3xl bg-card p-6 transition-colors duration-150 hover:bg-line/25 focus-visible:outline-offset-4";

/**
 * One number for the shop counter: what's safe to spend today. Opens Budgets. Before
 * any flexible budget, it asks for this month's spending money instead.
 */
export function SafeToSpendCard({ data }: { data: TodayData }) {
  const hidden = usePrivacy();
  const money = data.safeToSpend;
  if (!money.hasBudgets) return <FirstBudget data={data} />;
  const over = money.leftTodayMinor < 0;
  const pace = data.paceAlert ? `${data.paceAlert.name} is running ahead of the month` : null;
  return (
    <Link
      to="/money/budgets"
      aria-label={`${safeToSpendLabel(money, { hidden, paceAlert: pace })} Opens budgets`}
      className={`${CARD} flex flex-col gap-3`}
    >
      <p className="flex items-center justify-between text-callout text-muted">
        {over ? "Over today's amount by" : "Safe to spend today"}
        <ChevronRight
          aria-hidden
          className="size-4 opacity-0 transition-opacity group-hover:opacity-100"
        />
      </p>
      <Amount
        minor={Math.abs(money.leftTodayMinor)}
        tone={over ? "out" : "in"}
        className="block truncate text-hero"
      />
      <ProgressBar
        value={money.dailyMinor > 0 ? money.spentTodayMinor / money.dailyMinor : over ? 1 : 0}
        tone={over ? "coral" : "mint"}
      />
      <div className="flex items-center justify-between gap-3 text-callout text-muted">
        <span>
          <Amount minor={money.spentTodayMinor} animate={false} className="text-ink" /> spent of{" "}
          <Amount minor={money.dailyMinor} animate={false} className="text-ink" />
        </span>
        <span>{plural(money.daysLeft, "day")} left</span>
      </div>
      {data.paceAlert ? (
        <p className="text-callout text-coral-text">
          {data.paceAlert.emoji} {pace}
        </p>
      ) : null}
    </Link>
  );
}

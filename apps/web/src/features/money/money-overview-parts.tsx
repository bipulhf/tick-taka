import { Link } from "@tanstack/react-router";
import {
  ArrowUpDown,
  CalendarDays,
  HandCoins,
  Landmark,
  type LucideIcon,
  PieChart,
  PiggyBank,
  Plane,
  Receipt,
  ShoppingBasket,
} from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { Group, RowMark } from "@/components/ui/group";
import { ProgressBar } from "@/components/ui/progress";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useOpenPanel } from "@/lib/panel";
import { useSettings } from "@/lib/queries";
import { useThisMonth } from "@/lib/use-today";
import { BUCKETS, bucketLines, bucketShown, noBudgets } from "./budget-lines";
import { useBudgets } from "./queries";

const SHORTCUTS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/money/transactions", label: "Transactions", icon: ArrowUpDown },
  { to: "/money/budgets", label: "Budgets", icon: PieChart },
  { to: "/money/bills", label: "Bills", icon: Receipt },
  { to: "/money/goals", label: "Goals", icon: PiggyBank },
];

/** The phone's shortcut row: four quiet links under the total. */
export function MoneyShortcuts() {
  return (
    <nav aria-label="Money views" className="grid grid-cols-4 gap-2">
      {SHORTCUTS.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-caption font-bold transition-colors hover:bg-line/40"
        >
          <s.icon aria-hidden className="size-5 text-muted" />
          {s.label}
        </Link>
      ))}
    </nav>
  );
}

function MoreRow({
  to,
  icon,
  title,
  subtitle,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle?: string;
}) {
  return (
    <Link to={to} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5 hover:bg-line/30">
      <RowMark icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-semibold">{title}</span>
        {subtitle ? (
          <span className="block truncate text-callout text-muted">{subtitle}</span>
        ) : null}
      </span>
    </Link>
  );
}

/** The phone's "More" group: the views without a shortcut. */
export function MoneyMore() {
  const { data: settings } = useSettings();
  return (
    <Group>
      <MoreRow to="/money/debts" icon={HandCoins} title="Debts" subtitle="Who owes whom" />
      <MoreRow to="/money/events" icon={Plane} title="Events" subtitle="Trips and occasions" />
      <MoreRow
        to="/money/calendar"
        icon={CalendarDays}
        title="Calendar"
        subtitle="Spending by day"
      />
      {settings?.advancedViews.shoppingList ? (
        <MoreRow to="/money/shopping" icon={ShoppingBasket} title="Shopping" />
      ) : null}
      <MoreRow
        to="/money/accounts"
        icon={Landmark}
        title="Accounts"
        subtitle="Add, edit, reconcile"
      />
    </Group>
  );
}

/** This month's three budget groups at a glance: spent of the limit, with a bar. */
export function BudgetsAtAGlance() {
  const month = useThisMonth();
  const budgets = useBudgets(month);
  const open = useOpenPanel();
  const data = budgets.data;
  if (!data) return <SkeletonRows rows={3} />;
  if (noBudgets(data.lines))
    return (
      <EmptyState
        icon={PieChart}
        title="No budgets yet"
        message="Give a few categories a monthly limit so you can spend without second-guessing."
        actionLabel="Set budgets"
        onAction={() => open(`budget:${month}`)}
      />
    );
  const shown = BUCKETS.filter((b) =>
    bucketShown(data.buckets[b.key], bucketLines(data.lines, b.key)),
  );
  return (
    <Group>
      {shown.map((bucket) => {
        const totals = data.buckets[bucket.key];
        const over = totals.availableMinor < 0;
        return (
          <Link
            key={bucket.key}
            to="/money/budgets"
            className="flex flex-col gap-2 px-4 py-3 hover:bg-line/30"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-body font-semibold">{bucket.title}</span>
              <span className="text-callout text-muted">
                <Amount minor={totals.spentMinor} animate={false} className="font-bold text-ink" />{" "}
                of <Amount minor={totals.limitMinor} animate={false} />
              </span>
            </span>
            <ProgressBar
              value={totals.limitMinor ? totals.spentMinor / totals.limitMinor : 0}
              tone={over ? "coral" : "mint"}
              label={`${bucket.title} spent of its budget`}
            />
            {over ? (
              <span className="text-caption text-coral-text">
                Over by <Amount minor={-totals.availableMinor} animate={false} />
              </span>
            ) : null}
          </Link>
        );
      })}
    </Group>
  );
}

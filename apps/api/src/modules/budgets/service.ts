import {
  addMonths,
  daysLeftInMonth,
  type LocalDate,
  type LocalMonth,
  localMonthRange,
  monthOf,
  startOfLocalDay,
} from "@tick-taka/shared/dates";
import { budgetPace, type PaceStatus, safeToSpendToday } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import type { BudgetType } from "@tick-taka/shared/schemas/money";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { budgets, categories } from "../../db/schema/money";
import type { Deps } from "../../lib/deps";
import { foreignSpending, spendingRows } from "../../lib/money-queries";
import { userTime } from "../../lib/user-time";

type Category = typeof categories.$inferSelect;
type Budget = typeof budgets.$inferSelect;

export interface BudgetLine {
  categoryId: string;
  parentId: string | null;
  name: string;
  emoji: string;
  budgetType: BudgetType;
  hasBudget: boolean;
  limitMinor: number;
  rollover: boolean;
  carriedMinor: number;
  spentMinor: number;
  availableMinor: number;
  pace: PaceStatus | null;
}

export interface BucketTotals {
  limitMinor: number;
  spentMinor: number;
  availableMinor: number;
}

export interface BudgetMonth {
  month: LocalMonth;
  /** True when this month has no budgets yet and last month's limits are shown. */
  inherited: boolean;
  lines: BudgetLine[];
  buckets: Record<BudgetType, BucketTotals>;
  uncategorizedSpentMinor: number;
  /** Spending from accounts in other currencies, which budgets can't count. */
  foreignSpending: { currency: string; amountMinor: number }[];
}

function expenseCategories(deps: Deps): Category[] {
  return deps.db
    .select()
    .from(categories)
    .where(and(isNull(categories.deletedAt), eq(categories.kind, "expense")))
    .orderBy(categories.sort)
    .all();
}

function budgetsFor(deps: Deps, month: LocalMonth): Budget[] {
  return deps.db
    .select()
    .from(budgets)
    .where(and(isNull(budgets.deletedAt), eq(budgets.month, month)))
    .all();
}

/**
 * The month's budgets, or the latest earlier month's when none were ever set for
 * it. A month whose budgets were all removed stays empty instead of inheriting.
 */
function effectiveBudgets(deps: Deps, month: LocalMonth): { rows: Budget[]; inherited: boolean } {
  const own = budgetsFor(deps, month);
  if (own.length > 0) return { rows: own, inherited: false };
  const touched = deps.db
    .select({ id: budgets.id })
    .from(budgets)
    .where(eq(budgets.month, month))
    .get();
  if (touched) return { rows: [], inherited: false };
  const latest = deps.db
    .select({ month: budgets.month })
    .from(budgets)
    .where(and(isNull(budgets.deletedAt), lt(budgets.month, month)))
    .orderBy(desc(budgets.month))
    .get();
  return latest
    ? { rows: budgetsFor(deps, latest.month), inherited: true }
    : { rows: [], inherited: false };
}

/** Spending per category id, with each parent also carrying its children's spending. */
function spentByCategory(deps: Deps, cats: Category[], from: number, to: number) {
  const parentOf = new Map(cats.map((c) => [c.id, c.parentId]));
  const direct = new Map<string | null, number>();
  for (const row of spendingRows(deps.db, { from, to })) {
    const key = row.categoryId && parentOf.has(row.categoryId) ? row.categoryId : null;
    direct.set(key, (direct.get(key) ?? 0) + row.amountMinor);
  }
  const total = new Map<string, number>();
  for (const cat of cats) {
    const own = direct.get(cat.id) ?? 0;
    total.set(cat.id, (total.get(cat.id) ?? 0) + own);
    if (cat.parentId) total.set(cat.parentId, (total.get(cat.parentId) ?? 0) + own);
  }
  return { total, uncategorized: direct.get(null) ?? 0 };
}

/** How far back a chain of rollover months is followed. */
const MAX_ROLLOVER_MONTHS = 24;

/**
 * Money each category carries into `month`: last month's limit plus what it carried
 * in, minus what it spent, when rollover was on last month. Inherited months count,
 * so budgets set once keep carrying.
 */
function carriedInto(
  deps: Deps,
  cats: Category[],
  month: LocalMonth,
  timeZone: string,
  depth = 0,
): Map<string, number> {
  const carried = new Map<string, number>();
  if (depth >= MAX_ROLLOVER_MONTHS) return carried;
  const previousMonth = addMonths(month, -1);
  const previous = effectiveBudgets(deps, previousMonth).rows.filter((b) => b.rollover);
  if (previous.length === 0) return carried;
  const range = localMonthRange(previousMonth, timeZone);
  const spent = spentByCategory(deps, cats, range.from, range.to).total;
  const before = carriedInto(deps, cats, previousMonth, timeZone, depth + 1);
  for (const budget of previous) {
    const left =
      budget.limitMinor +
      (before.get(budget.categoryId) ?? 0) -
      (spent.get(budget.categoryId) ?? 0);
    carried.set(budget.categoryId, Math.max(0, left));
  }
  return carried;
}

export function budgetMonth(
  deps: Deps,
  month: LocalMonth,
  options: { today?: LocalDate; spentBefore?: number } = {},
): BudgetMonth {
  const { timeZone, today } = userTime(deps);
  const day = options.today ?? today;
  const cats = expenseCategories(deps);
  const range = localMonthRange(month, timeZone);
  const to = options.spentBefore === undefined ? range.to : Math.min(range.to, options.spentBefore);
  const { total: spent, uncategorized } = spentByCategory(deps, cats, range.from, to);
  const { rows, inherited } = effectiveBudgets(deps, month);
  const budgetByCat = new Map(rows.map((b) => [b.categoryId, b]));

  // Rollover: unspent money from last month's budget carries in when rollover is on.
  const carried = carriedInto(deps, cats, month, timeZone);

  const paceDay = monthOf(day) === month ? day : null;
  const lines: BudgetLine[] = cats.map((cat) => {
    const budget = budgetByCat.get(cat.id);
    const carriedMinor = budget?.rollover ? (carried.get(cat.id) ?? 0) : 0;
    const limitMinor = budget?.limitMinor ?? 0;
    const spentMinor = spent.get(cat.id) ?? 0;
    return {
      categoryId: cat.id,
      parentId: cat.parentId,
      name: cat.name,
      emoji: cat.emoji,
      budgetType: cat.budgetType,
      hasBudget: Boolean(budget),
      limitMinor,
      rollover: budget?.rollover ?? false,
      carriedMinor,
      spentMinor,
      availableMinor: limitMinor + carriedMinor - spentMinor,
      pace:
        budget && paceDay
          ? budgetPace(spentMinor, limitMinor + carriedMinor, paceDay).status
          : null,
    };
  });

  const buckets: Record<BudgetType, BucketTotals> = {
    fixed: { limitMinor: 0, spentMinor: 0, availableMinor: 0 },
    non_monthly: { limitMinor: 0, spentMinor: 0, availableMinor: 0 },
    flexible: { limitMinor: 0, spentMinor: uncategorized, availableMinor: 0 },
  };
  for (const parent of lines.filter((line) => line.parentId === null)) {
    const children = lines.filter((line) => line.parentId === parent.categoryId);
    const limit = parent.hasBudget
      ? parent.limitMinor + parent.carriedMinor
      : children.reduce((sum, child) => sum + child.limitMinor + child.carriedMinor, 0);
    const bucket = buckets[parent.budgetType];
    bucket.limitMinor += limit;
    bucket.spentMinor += parent.spentMinor;
  }
  for (const bucket of Object.values(buckets))
    bucket.availableMinor = bucket.limitMinor - bucket.spentMinor;

  return {
    month,
    inherited,
    lines,
    buckets,
    uncategorizedSpentMinor: uncategorized,
    foreignSpending: foreignSpending(deps.db, { from: range.from, to }),
  };
}

export interface SafeToSpend {
  /** What I can spend today without breaking this month's flexible budgets. */
  dailyMinor: number;
  spentTodayMinor: number;
  leftTodayMinor: number;
  flexibleLeftMinor: number;
  daysLeft: number;
  hasBudgets: boolean;
}

/**
 * Safe to spend today = flexible budget left this month (as of the start of today)
 * ÷ days left in the month, including today. Fixed bills are excluded.
 */
export function safeToSpend(deps: Deps, date?: LocalDate): SafeToSpend {
  const { timeZone, today } = userTime(deps);
  const day = date ?? today;
  const startOfToday = startOfLocalDay(day, timeZone);
  const month = monthOf(day);
  const beforeToday = budgetMonth(deps, month, { today: day, spentBefore: startOfToday });
  const wholeMonth = budgetMonth(deps, month, { today: day });
  const flexibleLeftMinor = beforeToday.buckets.flexible.availableMinor;
  const dailyMinor = safeToSpendToday(flexibleLeftMinor, day);
  const spentTodayMinor =
    wholeMonth.buckets.flexible.spentMinor - beforeToday.buckets.flexible.spentMinor;
  return {
    dailyMinor,
    spentTodayMinor,
    leftTodayMinor: dailyMinor - spentTodayMinor,
    flexibleLeftMinor,
    daysLeft: daysLeftInMonth(day),
    hasBudgets: wholeMonth.buckets.flexible.limitMinor > 0,
  };
}

/** Replaces a month's budgets with the given lines (others in the month are removed). */
export function putBudgets(
  deps: Deps,
  month: LocalMonth,
  lines: { categoryId: string; limitMinor: number; rollover: boolean }[],
): BudgetMonth {
  const now = deps.now();
  const keep = new Set(lines.map((line) => line.categoryId));
  deps.db.transaction((tx) => {
    for (const existing of budgetsFor(deps, month)) {
      if (!keep.has(existing.categoryId)) {
        tx.update(budgets)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(budgets.id, existing.id))
          .run();
      }
    }
    for (const line of lines) {
      tx.insert(budgets)
        .values({ id: newId(now), month, ...line, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: [budgets.categoryId, budgets.month],
          set: {
            limitMinor: line.limitMinor,
            rollover: line.rollover,
            updatedAt: now,
            deletedAt: null,
          },
        })
        .run();
    }
  });
  return budgetMonth(deps, month);
}

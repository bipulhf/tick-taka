import {
  addDays,
  diffDays,
  type LocalDate,
  startOfLocalDay,
  startOfWeek,
} from "@tick-taka/shared/dates";
import { formatAmount } from "@tick-taka/shared/money";
import { inArray } from "drizzle-orm";
import { categories } from "../../db/schema/money";
import type { Deps } from "../../lib/deps";
import { spendingRows, sumBy } from "../../lib/money-queries";
import { userTime } from "../../lib/user-time";

/**
 * Weekly recap card: this week's spend so far vs. the same days last week, the top
 * category, and one tip. It opens the weekly review.
 */
export function weeklyRecap(deps: Deps, date?: LocalDate) {
  const { timeZone, today, settings } = userTime(deps);
  const day = date ?? today;
  const weekStart = startOfWeek(day, settings.weekStartsOn);
  const span = diffDays(weekStart, day) + 1;
  const thisRange = {
    from: startOfLocalDay(weekStart, timeZone),
    to: startOfLocalDay(addDays(day, 1), timeZone),
  };
  const lastStart = addDays(weekStart, -7);
  const lastRange = {
    from: startOfLocalDay(lastStart, timeZone),
    to: startOfLocalDay(addDays(lastStart, span), timeZone),
  };
  const thisRows = spendingRows(deps.db, thisRange);
  const thisWeekMinor = thisRows.reduce((sum, row) => sum + row.amountMinor, 0);
  const lastWeekMinor = spendingRows(deps.db, lastRange).reduce(
    (sum, row) => sum + row.amountMinor,
    0,
  );

  const byCategory = [
    ...sumBy(
      thisRows,
      (r) => r.categoryId,
      (r) => r.amountMinor,
    ).entries(),
  ].sort((a, b) => b[1] - a[1]);
  const [topId, topAmount] = byCategory[0] ?? [null, 0];
  const top = topId
    ? deps.db
        .select()
        .from(categories)
        .where(inArray(categories.id, [topId]))
        .get()
    : undefined;

  const changeRatio = lastWeekMinor > 0 ? (thisWeekMinor - lastWeekMinor) / lastWeekMinor : null;
  let tip: string;
  if (thisWeekMinor === 0) tip = "A quiet week for spending. Nice and easy.";
  else if (changeRatio === null) tip = `${formatAmount(thisWeekMinor)} so far this week.`;
  else if (changeRatio > 0.15)
    tip = `Up ${Math.round(changeRatio * 100)}% on last week${top ? `, mostly ${top.name}` : ""}. A lighter weekend evens it out.`;
  else if (changeRatio < -0.15)
    tip = `Down ${Math.round(-changeRatio * 100)}% on last week. Lovely.`;
  else tip = "About the same as last week. Steady.";

  return {
    weekStart,
    days: span,
    thisWeekMinor,
    lastWeekMinor,
    changeRatio,
    topCategory: top
      ? { id: top.id, name: top.name, emoji: top.emoji, amountMinor: topAmount }
      : null,
    tip,
  };
}

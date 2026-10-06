import {
  type LocalMonth,
  localMonthRange,
  toLocalDate,
  toLocalMonth,
} from "@tick-taka/shared/dates";
import { and, gte, isNull, lt } from "drizzle-orm";
import { monthlyCapMicros } from "../../ai/usage";
import type { Db } from "../../db/client";
import { aiUsage } from "../../db/schema/system";
import type { Deps } from "../../lib/deps";
import { currentScope } from "../../lib/user-scope";
import { userTime } from "../../lib/user-time";

interface Totals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
}

const zero = (): Totals => ({ calls: 0, inputTokens: 0, outputTokens: 0, costMicros: 0 });

function rowsFor(db: Db, range: { from: number; to: number }) {
  return db
    .select()
    .from(aiUsage)
    .where(
      and(
        isNull(aiUsage.deletedAt),
        gte(aiUsage.createdAt, range.from),
        lt(aiUsage.createdAt, range.to),
      ),
    )
    .all();
}

function add(totals: Totals, row: Totals) {
  totals.calls += row.calls;
  totals.inputTokens += row.inputTokens;
  totals.outputTokens += row.outputTokens;
  totals.costMicros += row.costMicros;
}

/**
 * What AI cost in one month: the user's own total by day and by feature, and for
 * the owner (OWNER_EMAIL), every user's total, since the owner pays the bill.
 */
export function aiUsageReport(deps: Deps, month?: LocalMonth) {
  const { timeZone, now } = userTime(deps);
  const selected = month ?? toLocalMonth(now, timeZone);
  const range = localMonthRange(selected, timeZone);
  const total = zero();
  const byDay = new Map<string, Totals>();
  const byFeature = new Map<string, Totals & { feature: string }>();
  for (const row of rowsFor(deps.db, range)) {
    const one = { ...row, calls: 1 };
    add(total, one);
    const date = toLocalDate(row.createdAt, timeZone);
    add(byDay.get(date) ?? byDay.set(date, zero()).get(date)!, one);
    const feature =
      byFeature.get(row.feature) ??
      byFeature.set(row.feature, { feature: row.feature, ...zero() }).get(row.feature)!;
    add(feature, one);
  }

  const me = currentScope()?.user;
  const owner = !!me && !!deps.env.OWNER_EMAIL && me.email === deps.env.OWNER_EMAIL;
  const users = owner
    ? deps.users
        .list()
        .map((user) => {
          const sum = zero();
          for (const row of rowsFor(deps.users.data(user).db, range))
            add(sum, { ...row, calls: 1 });
          return { name: user.name, email: user.email, me: user.id === me.id, ...sum };
        })
        .sort((a, b) => b.costMicros - a.costMicros)
    : null;

  return {
    month: selected,
    ...total,
    capMicros: monthlyCapMicros(deps),
    byDay: [...byDay]
      .map(([date, sum]) => ({ date, ...sum }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    byFeature: [...byFeature.values()].sort((a, b) => b.costMicros - a.costMicros),
    /** Every user's spend this month; only the owner gets it. */
    users,
  };
}

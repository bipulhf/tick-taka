import { DAY_MS, toLocalMonth } from "@tick-taka/shared/dates";
import { and, eq, gte, isNull } from "drizzle-orm";
import { recurring, transactions } from "../../db/schema/money";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import { ruleText } from "../category-rules/service";

const LOOKBACK_DAYS = 150;

export interface SubscriptionCandidate {
  key: string;
  note: string | null;
  categoryId: string | null;
  accountId: string;
  amountMinor: number;
  occurrences: number;
  lastAt: number;
  months: string[];
}

/**
 * Subscription spotter: charges that repeat at the same amount about a month apart
 * and aren't tracked as a bill yet.
 */
export function spotSubscriptions(deps: Deps): SubscriptionCandidate[] {
  const { timeZone } = userTime(deps);
  const since = deps.now() - LOOKBACK_DAYS * DAY_MS;
  const rows = deps.db
    .select()
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.type, "expense"),
        gte(transactions.occurredAt, since),
      ),
    )
    .all()
    .filter((row) => row.recurringId === null && row.goalId === null && row.debtId === null);
  const tracked = deps.db
    .select({ name: recurring.name })
    .from(recurring)
    .where(isNull(recurring.deletedAt))
    .all()
    .map((r) => r.name.toLowerCase());

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const text = row.note ? ruleText(row.note) : null;
    const key = `${text ?? `category:${row.categoryId ?? "none"}`}|${row.amountMinor}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const candidates: SubscriptionCandidate[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    const sorted = group.sort((a, b) => a.occurredAt - b.occurredAt);
    const monthly = sorted.slice(1).every((row, i) => {
      const gapDays = (row.occurredAt - sorted[i]!.occurredAt) / DAY_MS;
      return gapDays >= 25 && gapDays <= 35;
    });
    const months = [...new Set(sorted.map((row) => toLocalMonth(row.occurredAt, timeZone)))];
    if (!monthly || months.length < 2) continue;
    const last = sorted.at(-1)!;
    const note = last.note;
    if (
      note &&
      tracked.some((name) => note.toLowerCase().includes(name) || name.includes(note.toLowerCase()))
    )
      continue;
    candidates.push({
      key,
      note,
      categoryId: last.categoryId,
      accountId: last.accountId,
      amountMinor: last.amountMinor,
      occurrences: sorted.length,
      lastAt: last.occurredAt,
      months,
    });
  }
  return candidates.sort((a, b) => b.amountMinor - a.amountMinor);
}

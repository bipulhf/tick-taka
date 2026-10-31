import { daysInMonth } from "@tick-taka/shared/dates";

/** Words and numbers for the AI cost view. Pure. */

export const FEATURES: Record<string, string> = {
  assistant: "Chat with Tiki and voice",
  parse: "Smart quick-add",
  receipt: "Receipt scan",
  // Removed features keep a label so older usage rows still read well.
  categorize: "Auto-categorise",
  planDay: "Plan my day",
  breakdown: "Break it down",
  weeklyReview: "Weekly coach",
  ask: "Ask my data",
  budgetSuggestions: "Budget suggestions",
};

/** Micro-dollars as dollars; tiny amounts keep enough digits to show they're not zero. */
export function dollars(micros: number): string {
  if (micros === 0) return "$0.00";
  if (micros < 10_000) return "<$0.01";
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

/** Micro-dollars as cents, for the day-by-day chart: "0.4¢", "12¢". */
export function cents(micros: number): string {
  const value = micros / 10_000;
  if (value === 0) return "0¢";
  return `${value < 10 ? Math.round(value * 10) / 10 : Math.round(value)}¢`;
}

export const thousands = (n: number) =>
  n >= 10_000 ? `${Math.round(n / 1000)}k` : n.toLocaleString("en");

/** The cost of every day of `month`, zeros included, so the columns keep their places. */
export function costByDay(
  month: string,
  byDay: { date: string; costMicros: number }[],
): { date: string; costMicros: number }[] {
  const cost = new Map(byDay.map((d) => [d.date, d.costMicros]));
  return Array.from({ length: daysInMonth(month) }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { date, costMicros: cost.get(date) ?? 0 };
  });
}

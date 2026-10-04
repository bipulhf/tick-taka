/**
 * Money maths shared by the server and the phone. Every input and output is an
 * integer in minor units, so the numbers reconcile exactly.
 */

import {
  addMonths,
  daysInMonth,
  daysLeftInMonth,
  type LocalDate,
  type LocalMonth,
  monthOf,
  parseLocalDate,
} from "./dates";

/**
 * Safe to spend today = flexible budget left this month ÷ days left in the month,
 * including today. Never negative.
 */
export function safeToSpendToday(flexibleLeftMinor: number, today: LocalDate): number {
  if (flexibleLeftMinor <= 0) return 0;
  return Math.floor(flexibleLeftMinor / daysLeftInMonth(today));
}

export type PaceStatus = "on_track" | "ahead" | "over";

export interface PaceResult {
  status: PaceStatus;
  /** Share of the limit spent, 0–1+ */
  spentRatio: number;
  /** Share of the month elapsed, 0–1 */
  timeRatio: number;
}

/**
 * Pace alert: spending is "ahead" when the share of budget used runs more than
 * `tolerance` ahead of the share of the month gone. Day counts include today.
 */
export function budgetPace(
  spentMinor: number,
  limitMinor: number,
  today: LocalDate,
  tolerance = 0.1,
): PaceResult {
  const total = daysInMonth(monthOf(today));
  const timeRatio = parseLocalDate(today).day / total;
  if (limitMinor <= 0)
    return {
      status: spentMinor > 0 ? "over" : "on_track",
      spentRatio: spentMinor > 0 ? 1 : 0,
      timeRatio,
    };
  const spentRatio = spentMinor / limitMinor;
  const status: PaceStatus =
    spentRatio >= 1 ? "over" : spentRatio > timeRatio + tolerance ? "ahead" : "on_track";
  return { status, spentRatio, timeRatio };
}

/** Months from `from` to `to` inclusive of the starting month (minimum 1). */
export function monthsUntil(from: LocalMonth, to: LocalMonth): number {
  const [fy, fm] = from.split("-").map(Number) as [number, number];
  const [ty, tm] = to.split("-").map(Number) as [number, number];
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}

/** Monthly amount to reach a savings goal by its deadline. */
export function suggestedMonthlySaving(
  targetMinor: number,
  savedMinor: number,
  today: LocalDate,
  deadline: LocalDate | null,
): number | null {
  if (!deadline) return null;
  const remaining = targetMinor - savedMinor;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthsUntil(monthOf(today), monthOf(deadline)));
}

export interface PayoffForecast {
  months: number;
  /** Month in which the last payment lands. */
  clearedIn: LocalMonth;
  lastPaymentMinor: number;
}

/** Debt payoff forecast: with a fixed monthly payment, which month is the debt cleared? */
export function debtPayoffForecast(
  outstandingMinor: number,
  monthlyPaymentMinor: number,
  startMonth: LocalMonth,
): PayoffForecast | null {
  if (outstandingMinor <= 0) return { months: 0, clearedIn: startMonth, lastPaymentMinor: 0 };
  if (monthlyPaymentMinor <= 0) return null;
  const months = Math.ceil(outstandingMinor / monthlyPaymentMinor);
  const lastPaymentMinor = outstandingMinor - monthlyPaymentMinor * (months - 1);
  return { months, clearedIn: addMonths(startMonth, months - 1), lastPaymentMinor };
}

/** Effective hourly rate in minor units per hour, or null when no hours were tracked. */
export function effectiveHourlyRate(incomeMinor: number, trackedMinutes: number): number | null {
  if (trackedMinutes <= 0) return null;
  return Math.round((incomeMinor * 60) / trackedMinutes);
}

/** "≈ 6.5 hours of work": price ÷ hourly rate, rounded to half hours. */
export function costInHours(amountMinor: number, hourlyRateMinor: number | null): number | null {
  if (!hourlyRateMinor || hourlyRateMinor <= 0) return null;
  return Math.round((amountMinor / hourlyRateMinor) * 2) / 2;
}

export interface BudgetLine {
  limitMinor: number;
  spentMinor: number;
  rollover: boolean;
  /** Unspent amount carried in from last month when rollover is on. */
  carriedMinor: number;
}

/** Money still available in a budget line this month (can be negative). */
export function budgetAvailable(line: BudgetLine): number {
  return line.limitMinor + (line.rollover ? line.carriedMinor : 0) - line.spentMinor;
}

/** Spread a non-monthly yearly amount into a monthly set-aside. */
export function monthlySetAside(yearlyMinor: number): number {
  return Math.ceil(yearlyMinor / 12);
}

/**
 * Light gamification: sparks, levels and streaks with freeze days. Rewards are
 * cosmetic only; a missed day costs a freeze, never a penalty.
 */

import { addDays, type LocalDate, monthOf, startOfWeek } from "./dates";

export const SPARKS = {
  taskDone: 10,
  topThreeTaskDone: 15,
  focusSession: 15,
  expenseLoggedSameDay: 5,
  habitChecked: 5,
} as const;

export const FREEZES_PER_MONTH = 2;

/** Total sparks needed to reach `level` (level 1 needs 0). */
export function sparksForLevel(level: number): number {
  return 50 * level * (level - 1);
}

export interface LevelProgress {
  level: number;
  sparks: number;
  currentLevelSparks: number;
  nextLevelSparks: number;
  /** 0–1 progress towards the next level */
  progress: number;
}

export function levelFromSparks(sparks: number): LevelProgress {
  let level = 1;
  while (sparksForLevel(level + 1) <= sparks) level++;
  const currentLevelSparks = sparksForLevel(level);
  const nextLevelSparks = sparksForLevel(level + 1);
  return {
    level,
    sparks,
    currentLevelSparks,
    nextLevelSparks,
    progress: (sparks - currentLevelSparks) / (nextLevelSparks - currentLevelSparks),
  };
}

export type RewardKind = "theme" | "outfit" | "icon";

export interface Reward {
  level: number;
  kind: RewardKind;
  id: string;
  name: string;
}

export const REWARDS: Reward[] = [
  { level: 2, kind: "outfit", id: "cap", name: "Tiki's cap" },
  { level: 3, kind: "theme", id: "mint-breeze", name: "Mint breeze theme" },
  { level: 4, kind: "icon", id: "night", name: "Night app icon" },
  { level: 5, kind: "outfit", id: "scarf", name: "Cosy scarf" },
  { level: 6, kind: "theme", id: "grape-dusk", name: "Grape dusk theme" },
  { level: 8, kind: "outfit", id: "crown", name: "Tiny crown" },
  { level: 10, kind: "icon", id: "gold", name: "Gold coin icon" },
];

export function unlockedRewards(level: number): Reward[] {
  return REWARDS.filter((reward) => reward.level <= level);
}

export type StreakSchedule = "daily" | "weekly" | "n_per_week";

export interface StreakInput {
  schedule: StreakSchedule;
  /** For n_per_week: done days needed per week */
  perWeek?: number | null;
  /** Local dates on which the target was met */
  doneDates: Iterable<LocalDate>;
  today: LocalDate;
  /** Days that never break a streak (days off, vacation) */
  skipDates?: Iterable<LocalDate>;
  weekStartsOn?: number;
  freezesPerMonth?: number;
  /** How far back to look */
  maxPeriods?: number;
}

export interface StreakResult {
  /** Consecutive periods (days or weeks) */
  current: number;
  best: number;
  unit: "day" | "week";
  freezesUsedThisMonth: number;
  freezesLeftThisMonth: number;
}

/**
 * Streaks with freeze days. Walking back from today, a missed period spends one of
 * that month's freezes; once a month runs out, the streak ends. The current period
 * never breaks a streak while it is still in progress.
 */
export function computeStreak(input: StreakInput): StreakResult {
  const done = new Set(input.doneDates);
  const skip = new Set(input.skipDates ?? []);
  const freezes = input.freezesPerMonth ?? FREEZES_PER_MONTH;
  const weekStartsOn = input.weekStartsOn ?? 6;
  const unit = input.schedule === "daily" ? "day" : "week";
  const maxPeriods = input.maxPeriods ?? (unit === "day" ? 730 : 104);
  const thisMonth = monthOf(input.today);

  // Periods from newest to oldest, each with its success status.
  const periods: { key: LocalDate; ok: boolean | "skip"; inProgress: boolean }[] = [];
  if (unit === "day") {
    for (let i = 0; i < maxPeriods; i++) {
      const date = addDays(input.today, -i);
      const ok = done.has(date) ? true : skip.has(date) ? "skip" : false;
      periods.push({ key: date, ok, inProgress: i === 0 });
    }
  } else {
    const needed = input.schedule === "weekly" ? 1 : Math.max(1, input.perWeek ?? 1);
    const currentWeek = startOfWeek(input.today, weekStartsOn);
    for (let i = 0; i < maxPeriods; i++) {
      const weekStart = addDays(currentWeek, -7 * i);
      let count = 0;
      let skipped = 0;
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d);
        if (done.has(date)) count++;
        else if (skip.has(date)) skipped++;
      }
      // A week where days off leave too few days to meet the target is neutral.
      const ok = count >= needed ? true : 7 - skipped < needed ? "skip" : false;
      periods.push({ key: weekStart, ok, inProgress: i === 0 });
    }
  }

  // Freezes are only committed once an older successful period proves the gap was bridged.
  const freezeUsage = new Map<string, number>();
  let pending = new Map<string, number>();
  const tryFreeze = (key: LocalDate) => {
    const month = monthOf(key);
    const used = (freezeUsage.get(month) ?? 0) + (pending.get(month) ?? 0);
    if (used >= freezes) return false;
    pending.set(month, (pending.get(month) ?? 0) + 1);
    return true;
  };

  let current = 0;
  for (const period of periods) {
    if (period.ok === true) {
      current++;
      for (const [month, count] of pending)
        freezeUsage.set(month, (freezeUsage.get(month) ?? 0) + count);
      pending = new Map();
    } else if (period.ok === "skip" || period.inProgress) {
      // neutral: days off, vacation, or today still in progress
    } else if (!tryFreeze(period.key)) {
      break;
    }
  }
  const freezesUsedThisMonth = freezeUsage.get(thisMonth) ?? 0;

  // Best streak over the whole window, oldest to newest, with the same freeze rules.
  let best = 0;
  let run = 0;
  const bestUsage = new Map<string, number>();
  for (const period of [...periods].reverse()) {
    if (period.ok === true) {
      run++;
      best = Math.max(best, run);
    } else if (period.ok === "skip" || period.inProgress) {
      // neutral
    } else {
      const month = monthOf(period.key);
      const used = bestUsage.get(month) ?? 0;
      if (used < freezes && run > 0) bestUsage.set(month, used + 1);
      else {
        run = 0;
      }
    }
  }
  best = Math.max(best, current);

  return {
    current,
    best,
    unit,
    freezesUsedThisMonth,
    freezesLeftThisMonth: Math.max(0, freezes - freezesUsedThisMonth),
  };
}

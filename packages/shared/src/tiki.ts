import { defined } from "./defined";
/**
 * Tiki, the coin-with-a-clock mascot. Tiki reacts to the day and never looks sad
 * or angry: overspending gets a calm face and a tip.
 */

export const TIKI_MOODS = [
  "happy",
  "proud",
  "relaxed",
  "calm",
  "sleepy",
  "focused",
  "cheering",
  "curious",
] as const;
export type TikiMood = (typeof TIKI_MOODS)[number];

export interface TikiInput {
  /** Local hour 0–23 */
  hour: number;
  topThreeTotal: number;
  topThreeDone: number;
  focusRunning: boolean;
  /** Null when no flexible budgets are set */
  leftTodayMinor: number | null;
  /** Nothing captured yet today */
  emptyDay?: boolean;
}

export function tikiMood(input: TikiInput): TikiMood {
  if (input.hour >= 23 || input.hour < 5) return "sleepy";
  if (input.focusRunning) return "focused";
  if (input.topThreeTotal > 0 && input.topThreeDone === input.topThreeTotal) return "proud";
  if (input.leftTodayMinor !== null && input.leftTodayMinor < 0) return "calm";
  if (input.leftTodayMinor !== null && input.leftTodayMinor > 0) return "relaxed";
  if (input.emptyDay) return "curious";
  return "happy";
}

const CALM_TIPS = [
  "Tomorrow's a fresh start. A cooked meal or a walk instead of a ride evens things out.",
  "No stress. Skipping one small treat this week brings the month back on track.",
  "It happens. Check the Money tab to see which category ran ahead.",
];

const GREETINGS: [number, string][] = [
  [5, "Good morning"],
  [12, "Good afternoon"],
  [17, "Good evening"],
  [22, "Good night"],
];

export function greeting(hour: number): string {
  let text = "Hello";
  for (const [from, words] of GREETINGS) if (hour >= from) text = words;
  return hour < 5 ? "Up late" : text;
}

/** A calm tip for an overspent day, stable for the given seed (e.g. the date). */
export function calmTip(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return defined(CALM_TIPS[hash % CALM_TIPS.length], "a calm tip");
}

export function tikiLine(mood: TikiMood, seed: string): string {
  switch (mood) {
    case "sleepy":
      return "Time to rest. Tiki says good night.";
    case "focused":
      return "Deep work in progress. Tiki is watering the plant.";
    case "proud":
      return "All three done. Tiki is proud of you!";
    case "calm":
      return calmTip(seed);
    case "relaxed":
      return "Spending's comfortably under budget.";
    case "curious":
      return "What's first today?";
    case "cheering":
      return "Big win!";
    default:
      return "Let's make today a good one.";
  }
}

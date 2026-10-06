import { z } from "zod";
import { addDays, DEFAULT_TIME_ZONE, DEFAULT_WEEK_STARTS_ON } from "../dates";
import { DEFAULT_WORKDAYS } from "../recurrence";
import { clockSchema, currencySchema, idSchema, localDateSchema } from "./common";

export const AI_FEATURES = [
  "parse",
  "receipt",
  "categorize",
  "planDay",
  "breakdown",
  "weeklyReview",
  "ask",
  "budgetSuggestions",
  "assistant",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/**
 * Every setting with its default. Stored as one row per key with a JSON value;
 * reads merge stored values over these defaults.
 */
export const settingsSchema = z.object({
  timeZone: z.string().default(DEFAULT_TIME_ZONE),
  defaultCurrency: currencySchema.default("BDT"),
  defaultAccountId: idSchema.nullable().default(null),
  cashAccountId: idSchema.nullable().default(null),
  theme: z.enum(["system", "light", "dark"]).default("system"),
  /** Accent tint for the surfaces ("mint-breeze", "grape-dusk"); the key predates its name. */
  rewardTheme: z.string().nullable().default(null),
  /** Tiki's outfit: "cap", "scarf", "crown" or none. */
  tikiOutfit: z.string().nullable().default(null),
  weekStartsOn: z.number().int().min(0).max(6).default(DEFAULT_WEEK_STARTS_ON),
  workdays: z.array(z.number().int().min(0).max(6)).default(DEFAULT_WORKDAYS),
  /** Free minutes on a working day, used by the "does my day fit?" bar. */
  dayCapacityMinutes: z
    .number()
    .int()
    .min(30)
    .max(24 * 60)
    .default(6 * 60),
  dailyTaskGoal: z.number().int().min(0).max(50).default(5),
  daysOff: z.array(z.number().int().min(0).max(6)).default([5]),
  vacationMode: z.boolean().default(false),
  /** Vacation periods, kept so past streaks stay intact; `to: null` is the current one. */
  vacations: z
    .array(z.object({ from: localDateSchema, to: localDateSchema.nullable() }))
    .default([]),
  advancedViews: z
    .object({
      eisenhower: z.boolean().default(false),
      energy: z.boolean().default(false),
      shoppingList: z.boolean().default(false),
    })
    .default({ eisenhower: false, energy: false, shoppingList: false }),
  focus: z
    .object({
      workMinutes: z.number().int().min(5).max(120).default(25),
      breakMinutes: z.number().int().min(1).max(60).default(5),
    })
    .default({ workMinutes: 25, breakMinutes: 5 }),
  quietHours: z
    .object({ start: clockSchema.default("23:00"), end: clockSchema.default("07:00") })
    .default({ start: "23:00", end: "07:00" }),
  shutdownTime: clockSchema.default("21:30"),
  weeklyReviewDay: z.number().int().min(0).max(6).default(0),
  weeklyReviewTime: clockSchema.default("19:00"),
  costInHours: z.boolean().default(true),
  costInHoursThresholdMinor: z.number().int().nonnegative().default(100_000),
  lockAfterMinutes: z.number().int().min(0).max(60).default(5),
  appLock: z.boolean().default(false),
  ai: z
    .object({
      enabled: z.boolean().default(true),
      features: z.partialRecord(z.enum(AI_FEATURES), z.boolean()).default({}),
    })
    .default({ enabled: true, features: {} }),
  billOverdueGraceDays: z.number().int().min(0).max(30).default(0),
  /** "Next week's focus" picked at the end of the weekly review. */
  weeklyFocus: z.string().max(200).nullable().default(null),
});
export type Settings = z.infer<typeof settingsSchema>;
export type SettingsKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = settingsSchema.parse({});

type SettingsShape = typeof settingsSchema.shape;
type PatchShape = {
  [K in keyof SettingsShape]: z.ZodOptional<SettingsShape[K]["def"]["innerType"]>;
};

/**
 * PATCH /settings accepts any subset of keys. Defaults are stripped first: in Zod 4
 * an optional field with a default still fills the default, which would overwrite
 * keys the client never sent. Nested objects are replaced whole.
 */
export const settingsPatchSchema = z.object(
  Object.fromEntries(
    Object.entries(settingsSchema.shape).map(([key, field]) => [key, field.unwrap().optional()]),
  ) as PatchShape,
);
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export function isAiFeatureEnabled(settings: Settings, feature: AiFeature): boolean {
  return settings.ai.enabled && settings.ai.features[feature] !== false;
}

/** Local dates covered by vacations, up to `today`. Streaks and goals skip them. */
export function vacationDates(settings: Pick<Settings, "vacations">, today: string): Set<string> {
  const dates = new Set<string>();
  for (const period of settings.vacations) {
    const end = period.to === null || period.to > today ? today : period.to;
    for (let d = period.from; d <= end; d = addDays(d, 1)) dates.add(d);
  }
  return dates;
}

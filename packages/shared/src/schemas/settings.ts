import { z } from "zod";
import { addDays, DEFAULT_TIME_ZONE, DEFAULT_WEEK_STARTS_ON, isTimeZone } from "../dates";
import { DEFAULT_WORKDAYS, daysOffFrom } from "../recurrence";
import { clockSchema, currencySchema, idSchema, localDateSchema } from "./common";

export const AI_FEATURES = [
  "parse",
  "receipt",
  "planDay",
  "breakdown",
  "weeklyReview",
  "budgetSuggestions",
  "assistant",
] as const;
export type AiFeature = (typeof AI_FEATURES)[number];

/** One optional switch per feature. A stored name that's no longer a feature is dropped. */
const aiFeatureSwitchesSchema = z.object(
  Object.fromEntries(AI_FEATURES.map((feature) => [feature, z.boolean().optional()])) as Record<
    AiFeature,
    z.ZodOptional<z.ZodBoolean>
  >,
);

const weekdaysSchema = z.array(z.number().int().min(0).max(6));

/**
 * Every setting with its default. Stored as one row per key with a JSON value;
 * reads merge stored values over these defaults.
 */
export const settingsSchema = z.object({
  /** An IANA zone the clock can use. A stored value that isn't one falls back on read. */
  timeZone: z.string().refine(isTimeZone, "Unknown time zone").default(DEFAULT_TIME_ZONE),
  defaultCurrency: currencySchema.default("BDT"),
  defaultAccountId: idSchema.nullable().default(null),
  cashAccountId: idSchema.nullable().default(null),
  theme: z.enum(["system", "light", "dark"]).default("system"),
  /** Digits amounts are shown in: "latn" 1,250 or "beng" ১,২৫০. Typing accepts both. */
  numerals: z.enum(["latn", "beng"]).default("latn"),
  /** Accent tint for the surfaces ("mint-breeze", "grape-dusk"); the key predates its name. */
  rewardTheme: z.string().nullable().default(null),
  /** Tiki's outfit: "cap", "scarf", "crown" or none. */
  tikiOutfit: z.string().nullable().default(null),
  weekStartsOn: z.number().int().min(0).max(6).default(DEFAULT_WEEK_STARTS_ON),
  /** Days of the week (0 = Sunday) with work; the rest are days off (`daysOffFrom`). */
  workdays: weekdaysSchema.default(DEFAULT_WORKDAYS),
  /** Free minutes on a working day, used by the "does my day fit?" bar. */
  dayCapacityMinutes: z
    .number()
    .int()
    .min(30)
    .max(24 * 60)
    .default(6 * 60),
  dailyTaskGoal: z.number().int().min(0).max(50).default(5),
  vacationMode: z.boolean().default(false),
  /** Vacation periods, kept so past streaks stay intact; `to: null` is the current one. */
  vacations: z
    .array(z.object({ from: localDateSchema, to: localDateSchema.nullable() }))
    .default([]),
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
  /** 0 = Sunday … 6 = Saturday; Friday by default (the Bangladesh weekend). */
  weeklyReviewDay: z.number().int().min(0).max(6).default(5),
  weeklyReviewTime: clockSchema.default("19:00"),
  costInHours: z.boolean().default(true),
  costInHoursThresholdMinor: z.number().int().nonnegative().default(100_000),
  lockAfterMinutes: z.number().int().min(0).max(60).default(5),
  appLock: z.boolean().default(false),
  ai: z
    .object({
      enabled: z.boolean().default(true),
      features: aiFeatureSwitchesSchema.default({}),
    })
    .default({ enabled: true, features: {} }),
  billOverdueGraceDays: z.number().int().min(0).max(30).default(0),
  /** "Next week's focus" picked at the end of the weekly review. */
  weeklyFocus: z.string().max(200).nullable().default(null),
  /** The day `weeklyFocus` was last saved, stamped by the server; Today hides an old focus. */
  weeklyFocusOn: localDateSchema.nullable().default(null),
  /** What the user asked Tiki to remember ("I get paid on the 25th"), oldest first. */
  tikiNotes: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
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

/** What the two settings defaulted to before `daysOff` folded into `workdays`. */
const LEGACY_WORKDAYS = [0, 1, 2, 3, 4];
const LEGACY_DAYS_OFF = [5];
const sameDays = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length && a.every((day) => b.includes(day));

/**
 * Stored settings rows (key → value) from before `daysOff` was dropped, made current.
 * Someone who changed their days off but never their workdays cared about the days
 * off, so their workdays become the other days. Otherwise stored workdays are kept
 * (and none stored means the default, Saturday to Thursday). `daysOff` goes either way.
 */
export function upgradeStoredSettings(stored: Record<string, unknown>): Record<string, unknown> {
  const { daysOff, ...rest } = stored;
  const oldDaysOff = weekdaysSchema.safeParse(daysOff);
  if (!oldDaysOff.success || sameDays(oldDaysOff.data, LEGACY_DAYS_OFF)) return rest;
  const workdays = weekdaysSchema.safeParse(rest.workdays);
  if (workdays.success && !sameDays(workdays.data, LEGACY_WORKDAYS)) return rest;
  // The complement works both ways: the days that aren't days off.
  return { ...rest, workdays: daysOffFrom(oldDaysOff.data) };
}

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

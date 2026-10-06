import { z } from "zod";
import { isLocalDate, isLocalMonth } from "../dates";
import { isValidRRule } from "../recurrence";

/** ULIDs are generated on the phone so records can be created offline. */
export const idSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "Expected a ULID");
export const epochMsSchema = z.number().int().nonnegative();
/** An instant the phone recorded, as ISO 8601 text ("2026-10-04T04:00:00.000Z"); parsed to epoch ms. */
export const tapTimeSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => Date.parse(value));
export const minorSchema = z.number().int();
export const positiveMinorSchema = z.number().int().positive();
export const localDateSchema = z.string().refine(isLocalDate, "Expected a date like 2026-10-04");
export const localMonthSchema = z.string().refine(isLocalMonth, "Expected a month like 2026-10");
export const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Expected a hex colour like #FFB547");
export const emojiSchema = z.string().min(1).max(16);
export const currencySchema = z
  .string()
  .regex(/^[A-Za-z]{3}$/, "Expected a 3-letter currency code")
  .transform((value) => value.toUpperCase());
export const rruleSchema = z
  .string()
  .max(200)
  .refine((value) => isValidRRule(value), "Unsupported repeat rule, or one that never comes due");
export const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a time like 21:30");
export const nameSchema = z.string().trim().min(1).max(120);
export const noteSchema = z.string().max(2000);

/** Query-string numbers arrive as text. */
export const queryEpochSchema = z.coerce.number().int().nonnegative();
export const queryBoolSchema = z.enum(["true", "false"]).transform((value) => value === "true");

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const syncQuerySchema = z.object({ since: queryEpochSchema.default(0) });

export const errorBodySchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

/** Every PATCH may carry the phone's edit time so stale offline edits lose (last write wins). */
export const editTimeShape = { updatedAt: epochMsSchema.optional() };

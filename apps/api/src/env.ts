import { dirname, join, resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  /** The single-user database from before sign-in with Google; OWNER_EMAIL inherits it. */
  DB_PATH: z.string().default("./data/app.db"),
  UPLOADS_DIR: z.string().optional(),
  BACKUPS_DIR: z.string().optional(),
  /** The sign-in list: one row per Google account. Defaults to users.db next to DB_PATH. */
  USERS_DB_PATH: z.string().optional(),
  /** One SQLite file per user lives here. Defaults to users/ next to DB_PATH. */
  USER_DATA_DIR: z.string().optional(),
  /**
   * OAuth client IDs whose Google ID tokens are accepted (comma-separated). The
   * phone asks Google for a token addressed to the Web client ID.
   */
  GOOGLE_CLIENT_IDS: z
    .string()
    .min(1, "GOOGLE_CLIENT_IDS is required (see README)")
    .transform((v) =>
      v
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  /** The Google email that takes over the data in DB_PATH from the single-user days. */
  OWNER_EMAIL: z
    .string()
    .optional()
    .transform((v) => v?.trim().toLowerCase() || undefined),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_FAST: z.string().default("gpt-6-luna"),
  OPENAI_MODEL_SMART: z.string().default("gpt-6-luna"),
  /** Speech to text for the assistant's microphone; handles Bangla and Bangla-English mix. */
  OPENAI_MODEL_TRANSCRIBE: z.string().default("gpt-4o-mini-transcribe"),
  /** Price per million tokens in micro-dollars, for the monthly cost cap. */
  OPENAI_FAST_INPUT_MICROS_PER_MTOK: z.coerce.number().nonnegative().default(250_000),
  OPENAI_FAST_OUTPUT_MICROS_PER_MTOK: z.coerce.number().nonnegative().default(2_000_000),
  OPENAI_SMART_INPUT_MICROS_PER_MTOK: z.coerce.number().nonnegative().default(1_250_000),
  OPENAI_SMART_OUTPUT_MICROS_PER_MTOK: z.coerce.number().nonnegative().default(10_000_000),
  /** Most any one user's AI calls may cost per month, in micro-dollars, whatever their setting. */
  AI_USER_MONTHLY_CAP_MICROS: z.coerce.number().int().nonnegative().default(2_000_000),
  /** Who runs the service, named on the public home, privacy and terms pages. */
  SITE_OPERATOR: z.string().default("Tick & Taka"),
  /** Where people write about their data or to delete their account; shown on those pages. */
  CONTACT_EMAIL: z.preprocess((v) => (v === "" ? undefined : v), z.email().optional()),
  JOBS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema> & {
  UPLOADS_DIR: string;
  BACKUPS_DIR: string;
  USERS_DB_PATH: string;
  USER_DATA_DIR: string;
};

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(`Invalid environment:\n${problems.join("\n")}`);
  }
  const env = result.data;
  const dataDir = env.DB_PATH === ":memory:" ? resolve("./data") : dirname(resolve(env.DB_PATH));
  return {
    ...env,
    UPLOADS_DIR: env.UPLOADS_DIR ?? join(dataDir, "uploads"),
    BACKUPS_DIR: env.BACKUPS_DIR ?? join(dataDir, "backups"),
    USERS_DB_PATH:
      env.USERS_DB_PATH ?? (env.DB_PATH === ":memory:" ? ":memory:" : join(dataDir, "users.db")),
    USER_DATA_DIR:
      env.USER_DATA_DIR ?? (env.DB_PATH === ":memory:" ? ":memory:" : join(dataDir, "users")),
  };
}

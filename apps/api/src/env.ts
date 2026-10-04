import { dirname, join, resolve } from "node:path";
import { z } from "zod";

const envSchema = z.object({
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().default("./data/app.db"),
  UPLOADS_DIR: z.string().optional(),
  BACKUPS_DIR: z.string().optional(),
  /** Base64 of a Bun.password hash; base64 because Bun expands `$` inside .env files. */
  APP_PASSWORD_HASH: z.string().min(20, "APP_PASSWORD_HASH is required (see README)"),
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
  JOBS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema> & { UPLOADS_DIR: string; BACKUPS_DIR: string };

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
  };
}

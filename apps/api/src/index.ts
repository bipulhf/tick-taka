import { createOpenAiClient } from "./ai/openai-client";
import { createApp } from "./app";
import { openDatabase } from "./db/client";
import { seedDefaults } from "./db/seed";
import { loadEnv } from "./env";
import { startJobs } from "./jobs/scheduler";

const env = loadEnv();
const { db, sqlite } = openDatabase(env.DB_PATH);
seedDefaults(db, Date.now());

const deps = { db, sqlite, env, now: Date.now, ai: createOpenAiClient(env) };
const app = createApp(deps);
if (env.JOBS_ENABLED) startJobs(deps);

console.log(`Tick & Taka API listening on http://${env.HOST}:${env.PORT}`);

export default {
  port: env.PORT,
  hostname: env.HOST,
  fetch: app.fetch,
};

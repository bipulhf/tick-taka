import { createOpenAiClient } from "./ai/openai-client";
import { createApp } from "./app";
import { createUserRegistry } from "./db/user-registry";
import { loadEnv } from "./env";
import { startJobs } from "./jobs/scheduler";
import { createDeps } from "./lib/deps";
import { createGoogleVerifier } from "./lib/google";

const env = loadEnv();
const deps = createDeps({
  env,
  now: Date.now,
  ai: createOpenAiClient(env),
  users: createUserRegistry(env, Date.now),
  verifyGoogle: createGoogleVerifier(env.GOOGLE_CLIENT_IDS),
});
const app = createApp(deps);
if (env.JOBS_ENABLED) startJobs(deps);
// Idle user databases are closed even when no request opens another.
setInterval(() => deps.users.sweep(), 60_000);

// Started explicitly: pm2 imports this file from its own wrapper, and Bun only
// serves a default-exported fetch when the file is the entry point.
Bun.serve({
  port: env.PORT,
  hostname: env.HOST,
  fetch: app.fetch,
  // Bun closes a connection after 10 quiet seconds by default; AI calls can take longer.
  idleTimeout: 120,
});

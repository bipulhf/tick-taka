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

export default {
  port: env.PORT,
  hostname: env.HOST,
  fetch: app.fetch,
};

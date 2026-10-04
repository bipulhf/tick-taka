import { createApp } from "./app";
import { openDatabase } from "./db/client";
import { seedDefaults } from "./db/seed";
import { loadEnv } from "./env";

const env = loadEnv();
const { db, sqlite } = openDatabase(env.DB_PATH);
seedDefaults(db, Date.now());

const app = createApp({ db, sqlite, env, now: Date.now, ai: null });

console.log(`Tick & Taka API listening on http://${env.HOST}:${env.PORT}`);

export default {
  port: env.PORT,
  hostname: env.HOST,
  fetch: app.fetch,
};

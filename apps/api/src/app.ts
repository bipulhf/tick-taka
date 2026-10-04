import { Hono } from "hono";
import type { Deps } from "./lib/deps";
import { requireAuth } from "./middleware/auth";
import { onError, onNotFound } from "./middleware/error-handler";
import { authRoutes } from "./modules/auth/routes";
import { settingsRoutes } from "./modules/settings/routes";

const startedAt = Date.now();

export function createApp(deps: Deps) {
  const api = new Hono()
    .use(requireAuth(deps.env.JWT_SECRET))
    .route("/settings", settingsRoutes(deps));

  return new Hono()
    .onError(onError)
    .notFound(onNotFound)
    .get("/health", (c) => c.json({ ok: true, uptimeMs: Date.now() - startedAt }))
    .route("/auth", authRoutes(deps))
    .route("/", api);
}

export type App = ReturnType<typeof createApp>;

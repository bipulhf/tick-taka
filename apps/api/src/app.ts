import { Hono } from "hono";
import type { Deps } from "./lib/deps";
import { requireAuth } from "./middleware/auth";
import { onError, onNotFound } from "./middleware/error-handler";
import { areasRoutes } from "./modules/areas/routes";
import { authRoutes } from "./modules/auth/routes";
import { habitsRoutes } from "./modules/habits/routes";
import { projectsRoutes } from "./modules/projects/routes";
import { routinesRoutes } from "./modules/routines/routes";
import { settingsRoutes } from "./modules/settings/routes";
import { tasksRoutes } from "./modules/tasks/routes";
import { timeEntriesRoutes, timerRoutes } from "./modules/time-entries/routes";

const startedAt = Date.now();

export function createApp(deps: Deps) {
  const api = new Hono()
    .use(requireAuth(deps.env.JWT_SECRET))
    .route("/settings", settingsRoutes(deps))
    .route("/areas", areasRoutes(deps))
    .route("/projects", projectsRoutes(deps))
    .route("/tasks", tasksRoutes(deps))
    .route("/routines", routinesRoutes(deps))
    .route("/timer", timerRoutes(deps))
    .route("/time-entries", timeEntriesRoutes(deps))
    .route("/habits", habitsRoutes(deps));

  return new Hono()
    .onError(onError)
    .notFound(onNotFound)
    .get("/health", (c) => c.json({ ok: true, uptimeMs: Date.now() - startedAt }))
    .route("/auth", authRoutes(deps))
    .route("/", api);
}

export type App = ReturnType<typeof createApp>;

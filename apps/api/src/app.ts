import { Hono } from "hono";
import type { Deps } from "./lib/deps";
import { requireAuth } from "./middleware/auth";
import { onError, onNotFound } from "./middleware/error-handler";
import { requestLog } from "./middleware/request-log";
import { accountsRoutes } from "./modules/accounts/routes";
import type { Dispatch } from "./modules/ai/assistant/dispatch";
import { aiRoutes } from "./modules/ai/routes";
import { areasRoutes } from "./modules/areas/routes";
import { authRoutes, meRoutes } from "./modules/auth/routes";
import { budgetsRoutes } from "./modules/budgets/routes";
import { categoriesRoutes } from "./modules/categories/routes";
import { categoryRulesRoutes } from "./modules/category-rules/routes";
import { debtsRoutes } from "./modules/debts/routes";
import { eventsRoutes } from "./modules/events/routes";
import { gamificationRoutes } from "./modules/gamification/routes";
import { goalsRoutes } from "./modules/goals/routes";
import { habitsRoutes } from "./modules/habits/routes";
import { insightsRoutes } from "./modules/insights/routes";
import { projectsRoutes } from "./modules/projects/routes";
import { recurringRoutes } from "./modules/recurring/routes";
import { reviewsRoutes } from "./modules/reviews/routes";
import { routinesRoutes } from "./modules/routines/routes";
import { settingsRoutes } from "./modules/settings/routes";
import { shoppingRoutes } from "./modules/shopping/routes";
import { siteRoutes } from "./modules/site/routes";
import { exportRoutes } from "./modules/sync/routes";
import { tasksRoutes } from "./modules/tasks/routes";
import { timeEntriesRoutes, timerRoutes } from "./modules/time-entries/routes";
import { todayRoutes } from "./modules/today/routes";
import { transactionsRoutes } from "./modules/transactions/routes";
import { uploadsRoutes } from "./modules/uploads/routes";

const startedAt = Date.now();

export function createApp(deps: Deps) {
  // The chat assistant calls the app's own routes, so its writes get the same validation.
  const dispatch: Dispatch = async (path, init) => app.request(path, init);
  const api = new Hono()
    .use(requireAuth(deps))
    .route("/me", meRoutes())
    .route("/settings", settingsRoutes(deps))
    .route("/areas", areasRoutes(deps))
    .route("/projects", projectsRoutes(deps))
    .route("/tasks", tasksRoutes(deps))
    .route("/routines", routinesRoutes(deps))
    .route("/timer", timerRoutes(deps))
    .route("/time-entries", timeEntriesRoutes(deps))
    .route("/habits", habitsRoutes(deps))
    .route("/accounts", accountsRoutes(deps))
    .route("/transactions", transactionsRoutes(deps))
    .route("/categories", categoriesRoutes(deps))
    .route("/category-rules", categoryRulesRoutes(deps))
    .route("/budgets", budgetsRoutes(deps))
    .route("/recurring", recurringRoutes(deps))
    .route("/goals", goalsRoutes(deps))
    .route("/debts", debtsRoutes(deps))
    .route("/events", eventsRoutes(deps))
    .route("/shopping", shoppingRoutes(deps))
    .route("/uploads", uploadsRoutes(deps))
    .route("/today", todayRoutes(deps))
    .route("/insights", insightsRoutes(deps))
    .route("/reviews", reviewsRoutes(deps))
    .route("/gamification", gamificationRoutes(deps))
    .route("/export", exportRoutes(deps))
    .route("/ai", aiRoutes(deps, dispatch));

  const app = new Hono()
    .use(requestLog(deps))
    // The phone reads this to send edit times in server time, so last-write-wins
    // isn't fooled by a phone clock that runs fast or slow.
    .use(async (c, next) => {
      await next();
      c.header("x-server-time", String(deps.now()));
    })
    .onError(onError)
    .notFound(onNotFound)
    .get("/health", (c) => c.json({ ok: true, uptimeMs: Date.now() - startedAt }))
    // Public pages, before the signed-in API so they never ask for a token.
    .route("/", siteRoutes(deps))
    .route("/auth", authRoutes(deps))
    .route("/", api);
  return app;
}

export type App = ReturnType<typeof createApp>;

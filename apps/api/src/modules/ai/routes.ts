import {
  aiAskRequestSchema,
  aiBreakdownRequestSchema,
  aiBudgetSuggestionsRequestSchema,
  aiCategorizeRequestSchema,
  aiParseRequestSchema,
  aiPlanDayRequestSchema,
  aiReceiptRequestSchema,
  aiWeeklyReviewRequestSchema,
} from "@tick-taka/shared/schemas/ai";
import { isAiFeatureEnabled } from "@tick-taka/shared/schemas/settings";
import { Hono } from "hono";
import { monthSpendMicros } from "../../ai/usage";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import { validate } from "../../lib/validate";
import { aiAsk } from "./ask";
import { aiBudgetSuggestions, aiWeeklyCoach } from "./coach";
import { aiCategorize, aiParse, aiReceipt } from "./parse";
import { aiBreakdown, aiPlanDay } from "./planning";

/** Every /ai/* route returns a draft or text and never writes a record. */
export const aiRoutes = (deps: Deps) =>
  new Hono()
    .get("/status", (c) => {
      const { settings } = userTime(deps);
      const spent = monthSpendMicros(deps);
      return c.json({
        configured: deps.ai !== null,
        enabled: settings.ai.enabled,
        monthSpendMicros: spent,
        monthlyCapMicros: settings.ai.monthlyCapMicros,
        capReached: spent >= settings.ai.monthlyCapMicros,
        features: {
          parse: isAiFeatureEnabled(settings, "parse"),
          receipt: isAiFeatureEnabled(settings, "receipt"),
          categorize: isAiFeatureEnabled(settings, "categorize"),
          planDay: isAiFeatureEnabled(settings, "planDay"),
          breakdown: isAiFeatureEnabled(settings, "breakdown"),
          weeklyReview: isAiFeatureEnabled(settings, "weeklyReview"),
          ask: isAiFeatureEnabled(settings, "ask"),
          budgetSuggestions: isAiFeatureEnabled(settings, "budgetSuggestions"),
        },
      });
    })
    .post("/parse", validate("json", aiParseRequestSchema), async (c) =>
      c.json(await aiParse(deps, c.req.valid("json"))),
    )
    .post("/receipt", validate("json", aiReceiptRequestSchema), async (c) =>
      c.json(await aiReceipt(deps, c.req.valid("json"))),
    )
    .post("/categorize", validate("json", aiCategorizeRequestSchema), async (c) =>
      c.json(await aiCategorize(deps, c.req.valid("json"))),
    )
    .post("/plan-day", validate("json", aiPlanDayRequestSchema), async (c) =>
      c.json(await aiPlanDay(deps, c.req.valid("json").date)),
    )
    .post("/breakdown", validate("json", aiBreakdownRequestSchema), async (c) =>
      c.json(await aiBreakdown(deps, c.req.valid("json"))),
    )
    .post("/weekly-review", validate("json", aiWeeklyReviewRequestSchema), async (c) =>
      c.json(await aiWeeklyCoach(deps, c.req.valid("json").weekStart)),
    )
    .post("/ask", validate("json", aiAskRequestSchema), async (c) =>
      c.json(await aiAsk(deps, c.req.valid("json").question)),
    )
    .post("/budget-suggestions", validate("json", aiBudgetSuggestionsRequestSchema), async (c) =>
      c.json(await aiBudgetSuggestions(deps, c.req.valid("json").month)),
    );

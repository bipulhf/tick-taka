import {
  aiAskRequestSchema,
  aiBreakdownRequestSchema,
  aiBudgetSuggestionsRequestSchema,
  aiCategorizeRequestSchema,
  aiParseRequestSchema,
  aiPlanDayRequestSchema,
  aiReceiptRequestSchema,
  aiTranscribeRequestSchema,
  aiWeeklyReviewRequestSchema,
  assistantRequestSchema,
} from "@tick-taka/shared/schemas/ai";
import { isAiFeatureEnabled } from "@tick-taka/shared/schemas/settings";
import { Hono } from "hono";
import { monthSpendMicros } from "../../ai/usage";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import { validate } from "../../lib/validate";
import { aiAsk } from "./ask";
import { aiAssistant } from "./assistant/agent";
import type { Dispatch } from "./assistant/dispatch";
import { aiBudgetSuggestions, aiWeeklyCoach } from "./coach";
import { aiCategorize, aiParse, aiReceipt } from "./parse";
import { aiBreakdown, aiPlanDay } from "./planning";
import { aiTranscribe } from "./voice";

/**
 * /ai/* routes return drafts or text and never write a record, except the chat
 * assistant, which writes only through the app's own routes (via `dispatch`).
 */
export const aiRoutes = (deps: Deps, dispatch: Dispatch) =>
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
          assistant: isAiFeatureEnabled(settings, "assistant"),
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
    .post("/assistant", validate("json", assistantRequestSchema), async (c) =>
      c.json(
        await aiAssistant(
          deps,
          dispatch,
          c.req.header("authorization") ?? "",
          c.req.valid("json").messages,
        ),
      ),
    )
    .post("/transcribe", validate("json", aiTranscribeRequestSchema), async (c) =>
      c.json(await aiTranscribe(deps, c.req.valid("json"))),
    )
    .post("/budget-suggestions", validate("json", aiBudgetSuggestionsRequestSchema), async (c) =>
      c.json(await aiBudgetSuggestions(deps, c.req.valid("json").month)),
    );

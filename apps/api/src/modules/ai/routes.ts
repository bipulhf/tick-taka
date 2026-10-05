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
import { localMonthSchema } from "@tick-taka/shared/schemas/common";
import { isAiFeatureEnabled } from "@tick-taka/shared/schemas/settings";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { monthlyCapMicros, monthSpendMicros, requireAi } from "../../ai/usage";
import type { Deps } from "../../lib/deps";
import { AppError } from "../../lib/errors";
import { userTime } from "../../lib/user-time";
import { validate } from "../../lib/validate";
import { aiAsk } from "./ask";
import { type AssistantEvent, aiAssistant } from "./assistant/agent";
import type { Dispatch } from "./assistant/dispatch";
import { aiBudgetSuggestions, aiWeeklyCoach } from "./coach";
import { aiCategorize, aiParse, aiReceipt } from "./parse";
import { aiBreakdown, aiPlanDay } from "./planning";
import { aiUsageReport } from "./usage-report";
import { aiTranscribe } from "./voice";

/** Proxies drop a connection that stays quiet too long while the model thinks. */
const KEEPALIVE_MS = 15_000;

/**
 * /ai/* routes return drafts or text and never write a record, except the chat
 * assistant, which writes only through the app's own routes (via `dispatch`).
 */
export const aiRoutes = (deps: Deps, dispatch: Dispatch) =>
  new Hono()
    .get("/status", (c) => {
      const { settings } = userTime(deps);
      const spent = monthSpendMicros(deps);
      const cap = monthlyCapMicros(deps, settings);
      return c.json({
        configured: deps.ai !== null,
        enabled: settings.ai.enabled,
        monthSpendMicros: spent,
        monthlyCapMicros: cap,
        /** The highest cap this user may choose. */
        maxCapMicros: deps.env.AI_USER_MONTHLY_CAP_MICROS,
        capReached: spent >= cap,
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
    .get("/usage", validate("query", z.object({ month: localMonthSchema.optional() })), (c) =>
      c.json(aiUsageReport(deps, c.req.valid("query").month)),
    )
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
    /**
     * Server-sent events, in order: status (a step), delta (reply text), reset,
     * action (a change made), then done with the whole answer, or error.
     */
    .post("/assistant", validate("json", assistantRequestSchema), (c) => {
      // Off switch, missing key and cap answer as plain JSON errors, before streaming.
      const ai = requireAi(deps, "assistant");
      const authorization = c.req.header("authorization") ?? "";
      const { messages } = c.req.valid("json");
      c.header("cache-control", "no-cache");
      c.header("x-accel-buffering", "no");
      return streamSSE(c, async (stream) => {
        let queue = Promise.resolve();
        const emit = (event: AssistantEvent | { type: "error"; code: string; message: string }) => {
          queue = queue.then(() =>
            stream.writeSSE({ event: event.type, data: JSON.stringify(event) }),
          );
        };
        const keepalive = setInterval(() => {
          queue = queue.then(() => stream.write(": keepalive\n\n").then(() => {}));
        }, KEEPALIVE_MS);
        try {
          await aiAssistant(deps, ai, dispatch, authorization, messages, emit);
        } catch (error) {
          const known = error instanceof AppError;
          if (!known) console.error("[ai] assistant failed", error);
          emit({
            type: "error",
            code: known ? error.code : "ai_error",
            message: known ? error.message : "Something went wrong. Try again.",
          });
        } finally {
          clearInterval(keepalive);
          await queue;
        }
      });
    })
    .post("/transcribe", validate("json", aiTranscribeRequestSchema), async (c) =>
      c.json(await aiTranscribe(deps, c.req.valid("json"))),
    )
    .post("/budget-suggestions", validate("json", aiBudgetSuggestionsRequestSchema), async (c) =>
      c.json(await aiBudgetSuggestions(deps, c.req.valid("json").month)),
    );

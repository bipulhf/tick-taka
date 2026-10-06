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
import { createMiddleware } from "hono/factory";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { monthlyCapMicros, monthSpendMicros, requireAi } from "../../ai/usage";
import type { Deps } from "../../lib/deps";
import { AppError } from "../../lib/errors";
import { errorFields, log, requestIdOf } from "../../lib/log";
import { currentScope } from "../../lib/user-scope";
import { userTime } from "../../lib/user-time";
import { validate } from "../../lib/validate";
import { SlidingWindowLimiter } from "../../middleware/rate-limit";
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
/** AI calls per user per minute; the monthly cap limits cost, this limits bursts. */
const AI_CALLS_PER_MINUTE = 30;

/** Limits each signed-in user's AI requests (reads like /ai/status are free). */
function aiRateLimit(deps: Deps) {
  const limiter = new SlidingWindowLimiter(AI_CALLS_PER_MINUTE, 60_000);
  return createMiddleware(async (c, next) => {
    const userId = currentScope()?.user.id;
    if (c.req.method === "POST" && userId) {
      const waitMs = limiter.attempt(userId, deps.now());
      if (waitMs > 0) {
        c.header("Retry-After", String(Math.ceil(waitMs / 1000)));
        throw new AppError(429, "too_many_requests", "Too many AI requests. Wait a minute.");
      }
    }
    await next();
  });
}

/**
 * /ai/* routes return drafts or text and never write a record, except the chat
 * assistant, which writes only through the app's own routes (via `dispatch`).
 */
export const aiRoutes = (deps: Deps, dispatch: Dispatch) =>
  new Hono()
    .use(aiRateLimit(deps))
    .get("/status", (c) => {
      const { settings } = userTime(deps);
      const spent = monthSpendMicros(deps);
      const cap = monthlyCapMicros(deps);
      return c.json({
        configured: deps.ai !== null,
        enabled: settings.ai.enabled,
        monthSpendMicros: spent,
        /** Null when this user has no limit (the owner, or a server without one). */
        monthlyCapMicros: cap,
        capReached: cap !== null && spent >= cap,
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
      const { messages, draftMoney } = c.req.valid("json");
      // When the phone goes away, stop: no more model calls (or cost) and no more writes.
      const controller = new AbortController();
      const stop = () => controller.abort();
      c.req.raw.signal.addEventListener("abort", stop);
      // The reply outlives this handler, so keep the user's database open until it ends.
      const scope = currentScope();
      const lease = scope ? deps.users.lease(scope.user) : null;
      c.header("cache-control", "no-cache");
      c.header("x-accel-buffering", "no");
      return streamSSE(c, async (stream) => {
        stream.onAbort(stop);
        let queue = Promise.resolve();
        const send = (write: () => Promise<unknown>) => {
          queue = queue
            .then(() => (controller.signal.aborted ? undefined : write()))
            .then(
              () => {},
              () => stop(),
            );
        };
        const emit = (event: AssistantEvent | { type: "error"; code: string; message: string }) =>
          send(() => stream.writeSSE({ event: event.type, data: JSON.stringify(event) }));
        const keepalive = setInterval(
          () => send(() => stream.write(": keepalive\n\n")),
          KEEPALIVE_MS,
        );
        try {
          await aiAssistant(deps, ai, dispatch, authorization, messages, emit, {
            signal: controller.signal,
            draftMoney: draftMoney === true,
          });
        } catch (error) {
          if (!controller.signal.aborted) {
            const known = error instanceof AppError;
            if (!known)
              log("error", "assistant failed", {
                reqId: requestIdOf(c.req.raw),
                ...errorFields(error),
              });
            emit({
              type: "error",
              code: known ? error.code : "ai_error",
              message: known ? error.message : "Something went wrong. Try again.",
            });
          }
        } finally {
          clearInterval(keepalive);
          c.req.raw.signal.removeEventListener("abort", stop);
          await queue;
          lease?.release();
        }
      });
    })
    .post("/transcribe", validate("json", aiTranscribeRequestSchema), async (c) =>
      c.json(await aiTranscribe(deps, c.req.valid("json"))),
    )
    .post("/budget-suggestions", validate("json", aiBudgetSuggestionsRequestSchema), async (c) =>
      c.json(await aiBudgetSuggestions(deps, c.req.valid("json").month)),
    );

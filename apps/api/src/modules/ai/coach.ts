import {
  addMonths,
  type LocalDate,
  type LocalMonth,
  localMonthRange,
} from "@tick-taka/shared/dates";
import { toMajor, toMinor } from "@tick-taka/shared/money";
import {
  aiBudgetSuggestionsOutputSchema,
  aiWeeklyReviewOutputSchema,
} from "@tick-taka/shared/schemas/ai";
import { toStrictJsonSchema } from "../../ai/json-schema";
import { callAi, logUsage, parseAiOutput, requireAi } from "../../ai/usage";
import type { Deps } from "../../lib/deps";
import { spendingRows, sumBy } from "../../lib/money-queries";
import { userTime } from "../../lib/user-time";
import { budgetMonth } from "../budgets/service";
import { weeklyReview } from "../reviews/service";
import { vocabulary } from "./context";
import { BUDGET_PROMPT, WEEKLY_COACH_PROMPT } from "./prompts";

const hours = (minutes: number) => Math.round((minutes / 60) * 10) / 10;

/** The server computes the week's numbers; AI only writes about them. */
export async function aiWeeklyCoach(deps: Deps, weekStart?: LocalDate) {
  const ai = requireAi(deps, "weeklyReview");
  const review = weeklyReview(deps, weekStart);
  const vocab = vocabulary(deps);
  const areaName = (id: string | null) =>
    vocab.areas.find((a) => a.id === id)?.name ?? "Unassigned";
  const categoryName = (id: string | null) =>
    vocab.categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const numbers = {
    week_start: review.weekStart,
    hours_by_area: review.hoursVsPlan.map((h) => ({
      area: areaName(h.areaId),
      planned_hours: hours(h.plannedMinutes),
      tracked_hours: hours(h.trackedMinutes),
    })),
    spending_taka: toMajor(review.spending.spentMinor),
    flexible_weekly_budget_taka: toMajor(review.spending.flexibleWeeklyBudgetMinor),
    top_categories: review.spending.byCategory
      .slice(0, 3)
      .map((c) => ({ category: categoryName(c.categoryId), taka: toMajor(c.amountMinor) })),
    habits: review.habits.map((h) => ({ habit: h.name, streak: h.streak, unit: h.unit })),
    tasks_done: review.wins.tasksDone,
    top_three_done: `${review.wins.topThreeDone} of ${review.wins.topThreePlanned}`,
    focus_minutes: review.wins.focusMinutes,
  };
  const result = await callAi(() =>
    ai.json({
      model: "smart",
      system: WEEKLY_COACH_PROMPT,
      user: JSON.stringify(numbers),
      schemaName: "weekly_review",
      jsonSchema: toStrictJsonSchema(aiWeeklyReviewOutputSchema),
    }),
  );
  logUsage(deps, "weeklyReview", "smart", result.model, result.usage);
  const output = parseAiOutput(aiWeeklyReviewOutputSchema, result.data);
  return {
    observations: output.observations.slice(0, 3),
    suggestion: output.suggestion,
    numbers: review,
  };
}

/** Budget suggestions for `month` from the last three months of spending. */
export async function aiBudgetSuggestions(deps: Deps, month: LocalMonth) {
  const ai = requireAi(deps, "budgetSuggestions");
  const { timeZone } = userTime(deps);
  const vocab = vocabulary(deps);
  const name = (id: string | null) => vocab.categories.find((c) => c.id === id)?.name ?? null;
  const history = [1, 2, 3].map((i) => {
    const m = addMonths(month, -i);
    const totals = sumBy(
      spendingRows(deps.db, localMonthRange(m, timeZone)),
      (r) => r.categoryId,
      (r) => r.amountMinor,
    );
    return {
      month: m,
      spending: [...totals.entries()]
        .filter(([id]) => name(id))
        .map(([id, minor]) => ({ category: name(id), taka: toMajor(minor) })),
    };
  });
  const current = budgetMonth(deps, addMonths(month, -1)).lines.filter((l) => l.hasBudget);
  const user = JSON.stringify({
    month,
    last_three_months: history,
    current_budgets: current.map((l) => ({
      category: l.name,
      bucket: l.budgetType,
      limit_taka: toMajor(l.limitMinor),
    })),
    expense_categories: vocab.categories.filter((c) => c.kind === "expense").map((c) => c.name),
  });
  const result = await callAi(() =>
    ai.json({
      model: "fast",
      system: BUDGET_PROMPT,
      user,
      schemaName: "budgets",
      jsonSchema: toStrictJsonSchema(aiBudgetSuggestionsOutputSchema),
    }),
  );
  logUsage(deps, "budgetSuggestions", "fast", result.model, result.usage);
  const output = parseAiOutput(aiBudgetSuggestionsOutputSchema, result.data);
  const expense = vocab.categories.filter((c) => c.kind === "expense");
  return {
    month,
    budgets: output.budgets
      .map((b) => {
        const category = expense.find((c) => c.name.toLowerCase() === b.categoryName.toLowerCase());
        if (!category || !(b.limit > 0)) return null;
        return {
          categoryId: category.id,
          limitMinor: Math.ceil(toMinor(b.limit) / 10_000) * 10_000,
          reason: b.reason,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null),
  };
}

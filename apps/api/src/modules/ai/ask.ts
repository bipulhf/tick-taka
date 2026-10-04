import {
  addDays,
  isLocalDate,
  isLocalMonth,
  type LocalDate,
  startOfLocalDay,
} from "@tick-taka/shared/dates";
import { toMajor } from "@tick-taka/shared/money";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import type { AiChatMessage, AiToolDefinition } from "../../ai/client";
import { callAi, logUsage, requireAi } from "../../ai/usage";
import { tasks } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { incomeRows, spendingRows, sumBy } from "../../lib/money-queries";
import { userTime } from "../../lib/user-time";
import { accountService } from "../accounts/service";
import { budgetMonth } from "../budgets/service";
import { debtService } from "../debts/service";
import { habitService } from "../habits/service";
import { timeEntryService } from "../time-entries/service";
import { vocabulary } from "./context";
import { ASK_PROMPT } from "./prompts";

const MAX_ROUNDS = 5;

const rangeParams = {
  type: "object",
  properties: {
    from: { type: "string", description: "First local date, YYYY-MM-DD" },
    to: { type: "string", description: "Last local date (inclusive), YYYY-MM-DD" },
  },
  required: ["from", "to"],
  additionalProperties: false,
};
const noParams = { type: "object", properties: {}, required: [], additionalProperties: false };

/** The only things "Ask my data" can do: fixed, read-only queries. It never writes or runs SQL. */
export const ASK_TOOLS: AiToolDefinition[] = [
  {
    name: "spendByCategory",
    description: "Spending per category in taka for a date range",
    parameters: rangeParams,
  },
  {
    name: "spendByArea",
    description: "Spending per life area in taka for a date range",
    parameters: rangeParams,
  },
  {
    name: "incomeByCategory",
    description: "Income per category in taka for a date range",
    parameters: rangeParams,
  },
  {
    name: "hoursByArea",
    description: "Tracked hours per life area for a date range",
    parameters: rangeParams,
  },
  {
    name: "tasksCompleted",
    description: "Number of finished tasks per area for a date range",
    parameters: rangeParams,
  },
  { name: "accountBalances", description: "Current balance of each account", parameters: noParams },
  {
    name: "budgetStatus",
    description: "Budget limit, spent and left per category for a month",
    parameters: {
      type: "object",
      properties: { month: { type: "string", description: "YYYY-MM" } },
      required: ["month"],
      additionalProperties: false,
    },
  },
  { name: "habitStreaks", description: "Current and best streak per habit", parameters: noParams },
  {
    name: "debtsSummary",
    description: "Open debts with direction and amount outstanding",
    parameters: noParams,
  },
];

export function runAskTool(deps: Deps, name: string, rawArgs: string): unknown {
  const { timeZone } = userTime(deps);
  const vocab = vocabulary(deps);
  const args = JSON.parse(rawArgs || "{}") as { from?: string; to?: string; month?: string };
  const range = () => {
    if (!args.from || !args.to || !isLocalDate(args.from) || !isLocalDate(args.to))
      throw new Error("Dates must be YYYY-MM-DD");
    return {
      from: startOfLocalDay(args.from, timeZone),
      to: startOfLocalDay(addDays(args.to as LocalDate, 1), timeZone),
    };
  };
  const areaName = (id: string | null) =>
    vocab.areas.find((a) => a.id === id)?.name ?? "Unassigned";
  const categoryName = (id: string | null) =>
    vocab.categories.find((c) => c.id === id)?.name ?? "Uncategorised";
  const list = (totals: Map<string | null, number>, label: (id: string | null) => string) =>
    [...totals.entries()]
      .map(([id, minor]) => ({ name: label(id), taka: toMajor(minor) }))
      .sort((a, b) => b.taka - a.taka);

  switch (name) {
    case "spendByCategory":
      return list(
        sumBy(
          spendingRows(deps.db, range()),
          (r) => r.categoryId,
          (r) => r.amountMinor,
        ),
        categoryName,
      );
    case "spendByArea":
      return list(
        sumBy(
          spendingRows(deps.db, range()),
          (r) => r.areaId,
          (r) => r.amountMinor,
        ),
        areaName,
      );
    case "incomeByCategory":
      return list(
        sumBy(
          incomeRows(deps.db, range()),
          (r) => r.categoryId,
          (r) => r.amountMinor,
        ),
        categoryName,
      );
    case "hoursByArea":
      return timeEntryService(deps)
        .minutesByArea(range())
        .map((m) => ({ area: areaName(m.areaId), hours: Math.round((m.minutes / 60) * 10) / 10 }));
    case "tasksCompleted": {
      const r = range();
      const done = deps.db
        .select({ areaId: tasks.areaId })
        .from(tasks)
        .where(
          and(
            isNull(tasks.deletedAt),
            eq(tasks.status, "done"),
            gte(tasks.doneAt, r.from),
            lt(tasks.doneAt, r.to),
          ),
        )
        .all();
      const counts = sumBy(
        done,
        (t) => t.areaId,
        () => 1,
      );
      return {
        total: done.length,
        byArea: [...counts.entries()].map(([id, count]) => ({ area: areaName(id), count })),
      };
    }
    case "accountBalances":
      return accountService(deps)
        .listWithBalances()
        .map((a) => ({
          account: a.name,
          type: a.type,
          currency: a.currency,
          balance: toMajor(a.balanceMinor, a.currency),
        }));
    case "budgetStatus": {
      if (!args.month || !isLocalMonth(args.month)) throw new Error("Month must be YYYY-MM");
      return budgetMonth(deps, args.month)
        .lines.filter((l) => l.hasBudget || l.spentMinor > 0)
        .map((l) => ({
          category: l.name,
          limit: toMajor(l.limitMinor),
          spent: toMajor(l.spentMinor),
          left: toMajor(l.availableMinor),
        }));
    }
    case "habitStreaks":
      return habitService(deps)
        .listWithProgress()
        .map((h) => ({
          habit: h.name,
          current: h.streak.current,
          best: h.streak.best,
          unit: h.streak.unit,
        }));
    case "debtsSummary":
      // Names in debts never leave the server; placeholders keep answers useful.
      return debtService(deps)
        .listWithBalance()
        .filter((d) => d.closedAt === null)
        .map((d, i) => ({
          person: `Person ${i + 1}`,
          direction: d.direction,
          outstanding: toMajor(d.outstandingMinor, d.currency),
        }));
    default:
      throw new Error(`Unknown function ${name}`);
  }
}

/** "Ask my data": function calling over the fixed query set above. */
export async function aiAsk(deps: Deps, question: string) {
  const ai = requireAi(deps, "ask");
  const { today } = userTime(deps);
  const messages: AiChatMessage[] = [
    { role: "system", content: `${ASK_PROMPT}\nToday is ${today}.` },
    { role: "user", content: question },
  ];
  const toolsUsed: string[] = [];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const result = await callAi(() => ai.chat({ model: "fast", messages, tools: ASK_TOOLS }));
    logUsage(deps, "ask", "fast", result.model, result.usage);
    if (result.toolCalls.length === 0) {
      return { answer: result.content?.trim() || "I couldn't find an answer to that.", toolsUsed };
    }
    messages.push({ role: "assistant", content: result.content, toolCalls: result.toolCalls });
    for (const call of result.toolCalls) {
      toolsUsed.push(call.name);
      let content: string;
      try {
        content = JSON.stringify(runAskTool(deps, call.name, call.arguments));
      } catch (error) {
        content = JSON.stringify({ error: (error as Error).message });
      }
      messages.push({ role: "tool", toolCallId: call.id, content });
    }
  }
  return {
    answer: "That question needed too many lookups. Try asking something narrower.",
    toolsUsed,
  };
}

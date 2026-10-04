import {
  endOfLocalDay,
  type LocalDate,
  localMinuteOfDay,
  parseLocalDate,
  startOfLocalDay,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { formatAmount } from "@tick-taka/shared/money";
import { parseClock } from "@tick-taka/shared/recurrence";
import { aiBreakdownOutputSchema, aiPlanDayOutputSchema } from "@tick-taka/shared/schemas/ai";
import { and, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import { toStrictJsonSchema } from "../../ai/json-schema";
import { callAi, logUsage, requireAi } from "../../ai/usage";
import { tasks } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import { recurringService } from "../recurring/service";
import { BREAKDOWN_PROMPT, PLAN_DAY_PROMPT } from "./prompts";

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const DAY_START_MINUTES = 9 * 60;

/** Plan my day: top three, estimates, fixed blocks and bills → a draggable timeline. */
export async function aiPlanDay(deps: Deps, date: LocalDate) {
  const ai = requireAi(deps, "planDay");
  const { timeZone, settings, today, now } = userTime(deps);
  const from = startOfLocalDay(date, timeZone);
  const to = endOfLocalDay(date, timeZone);
  const candidates = deps.db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(tasks.parentId),
        inArray(tasks.status, ["inbox", "open"]),
        or(eq(tasks.top3Date, date), and(gte(tasks.doAt, from), lt(tasks.doAt, to))),
      ),
    )
    .all();
  const fixed = candidates.filter((t) => t.hasTime && t.doAt !== null);
  const flexible = candidates.filter((t) => !(t.hasTime && t.doAt !== null));
  const bills = recurringService(deps)
    .listWithStatus()
    .filter((item) => item.dueDate === date);
  // Planning today starts from now (rounded up to the next quarter hour), not 9 am.
  const nowMinute = date === today ? Math.ceil(localMinuteOfDay(now, timeZone) / 15) * 15 : 0;
  const upcomingFixed = fixed.filter((t) => date !== today || t.doAt! >= now);
  const firstFixed = Math.max(
    nowMinute,
    Math.min(DAY_START_MINUTES, ...upcomingFixed.map((t) => localMinuteOfDay(t.doAt!, timeZone))),
  );
  const dayEnd = Math.min(23 * 60, firstFixed + settings.dayCapacityMinutes + 120);

  const describe = (t: (typeof candidates)[number]) =>
    JSON.stringify({
      id: t.id,
      title: t.title,
      minutes: t.estimateMin ?? 30,
      priority: t.priority,
      energy: t.energy,
      topThree: t.top3Date === date,
      evening: t.whenSlot === "evening",
    });
  const user = [
    `Date: ${date}. Plan between ${hhmm(firstFixed)} and ${hhmm(dayEnd)}. Free minutes for tasks: ${settings.dayCapacityMinutes}.`,
    `Fixed blocks: ${fixed.map((t) => `${hhmm(localMinuteOfDay(t.doAt!, timeZone))} ${describe(t)}`).join("; ") || "none"}`,
    `Tasks to place: ${flexible.map(describe).join("; ") || "none"}`,
    `Bills due today: ${bills.map((b) => `${b.name} ${formatAmount(b.amountMinor, { currency: b.currency })}`).join(", ") || "none"}`,
  ].join("\n");

  const result = await callAi(() =>
    ai.json({
      model: "fast",
      system: PLAN_DAY_PROMPT,
      user,
      schemaName: "day_plan",
      jsonSchema: toStrictJsonSchema(aiPlanDayOutputSchema),
    }),
  );
  logUsage(deps, "planDay", "fast", result.model, result.usage);
  const output = aiPlanDayOutputSchema.parse(result.data);
  const known = new Set(candidates.map((t) => t.id));
  const day = parseLocalDate(date);
  const blocks = output.blocks
    .map((block) => {
      const start = parseClock(block.start);
      const end = parseClock(block.end);
      if (!start || !end) return null;
      const startAt = zonedTimeToUtc({ ...day, ...start }, timeZone);
      const endAt = zonedTimeToUtc({ ...day, ...end }, timeZone);
      if (endAt <= startAt) return null;
      return {
        ...block,
        taskId: block.taskId && known.has(block.taskId) ? block.taskId : null,
        startAt,
        endAt,
      };
    })
    .filter((block): block is NonNullable<typeof block> => block !== null)
    .sort((a, b) => a.startAt - b.startAt);
  return { date, blocks, note: output.note };
}

/** Break it down: 3–7 concrete subtasks for a big, vague task. */
export async function aiBreakdown(
  deps: Deps,
  input: { title: string; notes?: string | undefined },
) {
  const ai = requireAi(deps, "breakdown");
  const result = await callAi(() =>
    ai.json({
      model: "fast",
      system: BREAKDOWN_PROMPT,
      user: `Task: ${JSON.stringify(input.title)}${input.notes ? `\nNotes: ${JSON.stringify(input.notes)}` : ""}`,
      schemaName: "breakdown",
      jsonSchema: toStrictJsonSchema(aiBreakdownOutputSchema),
    }),
  );
  logUsage(deps, "breakdown", "fast", result.model, result.usage);
  const subtasks = aiBreakdownOutputSchema
    .parse(result.data)
    .subtasks.map((s) => s.trim().slice(0, 300))
    .filter(Boolean)
    .slice(0, 7);
  return { subtasks };
}

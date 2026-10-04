import { localMonthRange, monthOf, startOfLocalDay } from "@tick-taka/shared/dates";
import { suggestedMonthlySaving } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import { formatAmount } from "@tick-taka/shared/money";
import type {
  goalContributeSchema,
  goalCreateSchema,
  goalUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { and, eq, gte, isNull, lt } from "drizzle-orm";
import type { z } from "zod";
import { goals, transactions } from "../../db/schema/money";
import { tasks } from "../../db/schema/time";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { badRequest } from "../../lib/errors";
import { userTime } from "../../lib/user-time";

export type Goal = typeof goals.$inferSelect;
export interface GoalWithProgress extends Goal {
  savedMinor: number;
  progress: number;
  reached: boolean;
  suggestedMonthlyMinor: number | null;
}

export function goalService(deps: Deps) {
  const base = crud(deps.db, goals, "Goal", deps.now);
  const db = deps.db;

  /** Progress = the sum of transactions carrying this goal_id. */
  function savedFor(goal: Goal): number {
    const rows = db
      .select()
      .from(transactions)
      .where(and(isNull(transactions.deletedAt), eq(transactions.goalId, goal.id)))
      .all();
    let saved = 0;
    for (const row of rows) {
      if (row.type === "transfer") {
        if (goal.accountId && row.toAccountId === goal.accountId)
          saved += row.toAmountMinor ?? row.amountMinor;
        else if (goal.accountId && row.accountId === goal.accountId) saved -= row.amountMinor;
        else saved += row.amountMinor;
      } else if (row.type === "expense") saved += row.amountMinor;
      else if (row.type === "income") saved -= row.amountMinor;
    }
    return saved;
  }

  function withProgress(goal: Goal, today: string): GoalWithProgress {
    const savedMinor = savedFor(goal);
    return {
      ...goal,
      savedMinor,
      progress: Math.min(1, savedMinor / goal.targetMinor),
      reached: savedMinor >= goal.targetMinor,
      suggestedMonthlyMinor: suggestedMonthlySaving(
        goal.targetMinor,
        savedMinor,
        today,
        goal.deadline,
      ),
    };
  }

  const service = {
    ...base,

    listWithProgress(): GoalWithProgress[] {
      const { today } = userTime(deps);
      return base.list().map((goal) => withProgress(goal, today));
    },

    getWithProgress(id: string): GoalWithProgress {
      return withProgress(base.get(id), userTime(deps).today);
    },

    create(input: z.output<typeof goalCreateSchema>): GoalWithProgress {
      const goal = base.create({
        ...input,
        deadline: input.deadline ?? null,
        accountId: input.accountId ?? null,
        doneAt: null,
      });
      service.ensureMonthlyTasks();
      return service.getWithProgress(goal.id);
    },

    update(id: string, input: z.output<typeof goalUpdateSchema>): GoalWithProgress {
      const { done, ...fields } = input;
      base.update(id, {
        ...fields,
        ...(done === undefined ? {} : { doneAt: done ? deps.now() : null }),
      });
      return service.getWithProgress(id);
    },

    /**
     * Moves money into the jar. With a savings account it's a transfer; without one
     * the money is set aside from the source account (an expense not counted as spending).
     */
    contribute(id: string, input: z.output<typeof goalContributeSchema>) {
      const goal = base.get(id);
      if (goal.accountId === input.fromAccountId)
        throw badRequest("Pick an account other than the jar's");
      const now = deps.now();
      const transactionId = input.id ?? newId(now);
      db.insert(transactions)
        .values({
          id: transactionId,
          type: goal.accountId ? "transfer" : "expense",
          accountId: input.fromAccountId,
          toAccountId: goal.accountId,
          amountMinor: input.amountMinor,
          feeMinor: 0,
          goalId: goal.id,
          note: `${goal.emoji} ${goal.name}`,
          occurredAt: input.occurredAt ?? now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
      const updated = service.getWithProgress(id);
      const justReached = updated.reached && goal.doneAt === null;
      if (justReached) base.update(id, { doneAt: now });
      return { goal: service.getWithProgress(id), justReached };
    },

    /**
     * Goals become tasks: each goal with a deadline gets one "move ৳X to the jar"
     * task per month. Safe to call repeatedly.
     */
    ensureMonthlyTasks(): number {
      const { timeZone, today } = userTime(deps);
      const month = monthOf(today);
      const range = localMonthRange(month, timeZone);
      let created = 0;
      for (const goal of service.listWithProgress()) {
        if (!goal.createTasks || !goal.deadline || goal.doneAt || goal.reached) continue;
        if (!goal.suggestedMonthlyMinor) continue;
        const existing = db
          .select({ id: tasks.id })
          .from(tasks)
          .where(
            and(eq(tasks.goalId, goal.id), gte(tasks.doAt, range.from), lt(tasks.doAt, range.to)),
          )
          .get();
        if (existing) continue;
        const now = deps.now();
        db.insert(tasks)
          .values({
            id: newId(now),
            title: `Move ${formatAmount(goal.suggestedMonthlyMinor)} to the ${goal.name} jar`,
            status: "open",
            priority: "normal",
            doAt: startOfLocalDay(today, timeZone),
            goalId: goal.id,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        created++;
      }
      return created;
    },
  };
  return service;
}

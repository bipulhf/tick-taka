import { newId } from "@tick-taka/shared/ids";
import type { routineCreateSchema, routineUpdateSchema } from "@tick-taka/shared/schemas/time";
import { and, asc, eq, inArray, isNull, notInArray } from "drizzle-orm";
import type { z } from "zod";
import { routineSteps, routines } from "../../db/schema/time";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";

type RoutineCreate = z.infer<typeof routineCreateSchema>;
type RoutineUpdate = z.infer<typeof routineUpdateSchema>;
type Step = NonNullable<RoutineCreate["steps"]>[number];

export function routineService(deps: Deps) {
  const base = crud(deps.db, routines, "Routine", deps.now);
  const steps = crud(deps.db, routineSteps, "Routine step", deps.now);
  const db = deps.db;

  const withSteps = (routine: typeof routines.$inferSelect) => ({
    ...routine,
    steps: steps.list(eq(routineSteps.routineId, routine.id), asc(routineSteps.sort)),
  });

  /** Replaces the routine's steps with `next`: upserts by id, soft-deletes the rest. */
  function replaceSteps(routineId: string, next: Step[]) {
    const keepIds = next.map((step) => step.id).filter((id): id is string => Boolean(id));
    const time = deps.now();
    db.update(routineSteps)
      .set({ deletedAt: time, updatedAt: time })
      .where(
        and(
          eq(routineSteps.routineId, routineId),
          isNull(routineSteps.deletedAt),
          keepIds.length ? notInArray(routineSteps.id, keepIds) : undefined,
        ),
      )
      .run();
    const existing = new Set(
      keepIds.length
        ? db
            .select({ id: routineSteps.id })
            .from(routineSteps)
            .where(inArray(routineSteps.id, keepIds))
            .all()
            .map((row) => row.id)
        : [],
    );
    next.forEach((step, index) => {
      const values = { title: step.title, minutes: step.minutes ?? null, sort: step.sort ?? index };
      if (step.id && existing.has(step.id)) {
        db.update(routineSteps)
          .set({ ...values, deletedAt: null, updatedAt: time })
          .where(eq(routineSteps.id, step.id))
          .run();
      } else {
        steps.create({ id: step.id ?? newId(time), routineId, ...values });
      }
    });
  }

  return {
    list: () => base.list(undefined, asc(routines.sort)).map(withSteps),
    get: (id: string) => withSteps(base.get(id)),
    create(input: RoutineCreate) {
      const existing = input.id ? base.find(input.id, true) : undefined;
      if (existing) return withSteps(existing);
      return db.transaction(() => {
        const routine = base.create({
          id: input.id,
          name: input.name,
          emoji: input.emoji,
          sort: input.sort ?? 0,
        });
        replaceSteps(routine.id, input.steps ?? []);
        return withSteps(routine);
      });
    },
    update(id: string, input: RoutineUpdate) {
      return db.transaction(() => {
        const { steps: nextSteps, ...fields } = input;
        const routine = base.update(id, fields);
        if (nextSteps) replaceSteps(id, nextSteps);
        return withSteps(routine);
      });
    },
    remove: (id: string) => base.remove(id),
    restore: (id: string) => withSteps(base.restore(id)),
  };
}

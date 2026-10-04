import { DEFAULT_AREAS, DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "@tick-taka/shared/defaults";
import { newId } from "@tick-taka/shared/ids";
import { readFlag, writeFlag } from "../modules/settings/service";
import type { Db } from "./client";
import { categories } from "./schema/money";
import { areas, routineSteps, routines } from "./schema/time";

/** First start only: areas, categories with buckets, and the two routines. */
export function seedDefaults(db: Db, now: number): boolean {
  if (readFlag(db, "_seededAt")) return false;
  const stamp = { createdAt: now, updatedAt: now, deletedAt: null };
  db.transaction((tx) => {
    DEFAULT_AREAS.forEach((area, sort) => {
      tx.insert(areas)
        .values({
          id: newId(now),
          name: area.name,
          emoji: area.emoji,
          color: area.color,
          sort,
          ...stamp,
        })
        .run();
    });
    DEFAULT_CATEGORIES.forEach((category, sort) => {
      const parentId = newId(now);
      tx.insert(categories)
        .values({
          id: parentId,
          parentId: null,
          name: category.name,
          emoji: category.emoji,
          kind: category.kind,
          budgetType: category.budgetType,
          sort,
          ...stamp,
        })
        .run();
      category.children?.forEach((child, childSort) => {
        tx.insert(categories)
          .values({
            id: newId(now),
            parentId,
            name: child.name,
            emoji: child.emoji,
            kind: category.kind,
            budgetType: category.budgetType,
            sort: childSort,
            ...stamp,
          })
          .run();
      });
    });
    DEFAULT_ROUTINES.forEach((routine, sort) => {
      const routineId = newId(now);
      tx.insert(routines)
        .values({ id: routineId, name: routine.name, emoji: routine.emoji, sort, ...stamp })
        .run();
      routine.steps.forEach((step, stepSort) => {
        tx.insert(routineSteps)
          .values({
            id: newId(now),
            routineId,
            title: step.title,
            minutes: step.minutes,
            sort: stepSort,
            ...stamp,
          })
          .run();
      });
    });
  });
  writeFlag(db, "_seededAt", now, now);
  return true;
}

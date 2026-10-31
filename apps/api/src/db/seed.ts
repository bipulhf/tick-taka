import { DEFAULT_AREAS, DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "@tick-taka/shared/defaults";
import { newId } from "@tick-taka/shared/ids";
import { readFlag, readSettings, writeFlag, writeSettings } from "../modules/settings/service";
import type { Db } from "./client";
import { accounts, categories } from "./schema/money";
import { areas, routineSteps, routines } from "./schema/time";

/**
 * A "Cash" account at ৳0, set as the default and cash account, so the first
 * expense typed has somewhere to go. Skipped when the database already has an
 * account (the owner's inherited data), and settings already set are kept.
 */
function seedCashAccount(db: Db, now: number): void {
  if (db.select({ id: accounts.id }).from(accounts).get()) return;
  const current = readSettings(db);
  const id = newId(now);
  db.insert(accounts)
    .values({
      id,
      name: "Cash",
      type: "cash",
      currency: current.defaultCurrency,
      openingMinor: 0,
      sort: 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .run();
  writeSettings(
    db,
    {
      ...(current.defaultAccountId ? {} : { defaultAccountId: id }),
      ...(current.cashAccountId ? {} : { cashAccountId: id }),
    },
    now,
  );
}

/** First start only: areas, categories with buckets, the Morning routine and a Cash account. */
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
  seedCashAccount(db, now);
  writeFlag(db, "_seededAt", now, now);
  return true;
}

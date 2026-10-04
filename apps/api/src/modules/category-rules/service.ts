import { newId } from "@tick-taka/shared/ids";
import { categoryRules } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";

/** Normalised text a rule matches on: lowercase, single spaces, trimmed. */
export function ruleText(note: string): string | null {
  const text = note.trim().toLowerCase().replace(/\s+/g, " ");
  return text.length >= 2 && text.length <= 80 ? text : null;
}

export function categoryRuleService(deps: Deps) {
  const base = crud(deps.db, categoryRules, "Category rule", deps.now);
  return {
    ...base,
    /** Learn from a correction: the same note gets this category next time. */
    learn(note: string, categoryId: string | null, areaId: string | null = null) {
      const matchText = ruleText(note);
      if (!matchText) return null;
      const now = deps.now();
      deps.db
        .insert(categoryRules)
        .values({ id: newId(now), matchText, categoryId, areaId, createdAt: now, updatedAt: now })
        .onConflictDoUpdate({
          target: categoryRules.matchText,
          set: { categoryId, areaId, updatedAt: now, deletedAt: null },
        })
        .run();
      return matchText;
    },
  };
}

import { and, eq, isNull } from "drizzle-orm";
import { accounts, categories, categoryRules } from "../../db/schema/money";
import { areas } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";

export interface Vocabulary {
  accounts: { id: string; name: string; type: string; currency: string }[];
  categories: { id: string; name: string; kind: "expense" | "income"; parentId: string | null }[];
  areas: { id: string; name: string }[];
}

/** Names the model may use. IDs and account numbers never leave the server. */
export function vocabulary(deps: Deps): Vocabulary {
  return {
    accounts: deps.db
      .select({
        id: accounts.id,
        name: accounts.name,
        type: accounts.type,
        currency: accounts.currency,
      })
      .from(accounts)
      .where(and(isNull(accounts.deletedAt), isNull(accounts.archivedAt)))
      .all(),
    categories: deps.db
      .select({
        id: categories.id,
        name: categories.name,
        kind: categories.kind,
        parentId: categories.parentId,
      })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .all(),
    areas: deps.db
      .select({ id: areas.id, name: areas.name })
      .from(areas)
      .where(isNull(areas.deletedAt))
      .all(),
  };
}

export function describeVocabulary(
  vocab: Vocabulary,
  kinds: ("expense" | "income")[] = ["expense", "income"],
): string {
  const categoryLines = vocab.categories
    .filter((c) => kinds.includes(c.kind))
    .map((c) => `${c.name} (${c.kind})`)
    .join(", ");
  return [
    `Accounts: ${vocab.accounts.map((a) => `${a.name} (${a.type}, ${a.currency})`).join(", ") || "none"}`,
    `Categories: ${categoryLines || "none"}`,
    `Areas: ${vocab.areas.map((a) => a.name).join(", ") || "none"}`,
  ].join("\n");
}

const norm = (value: string) => value.trim().toLowerCase();

export function findByName<T extends { name: string }>(
  items: T[],
  name: string | null,
): T | undefined {
  if (!name) return undefined;
  return (
    items.find((item) => norm(item.name) === norm(name)) ??
    items.find((item) => norm(item.name).includes(norm(name)))
  );
}

export function recentCorrections(
  deps: Deps,
  limit = 20,
): { matchText: string; category: string | null }[] {
  return deps.db
    .select({ matchText: categoryRules.matchText, category: categories.name })
    .from(categoryRules)
    .leftJoin(categories, eq(categories.id, categoryRules.categoryId))
    .where(isNull(categoryRules.deletedAt))
    .limit(limit)
    .all();
}

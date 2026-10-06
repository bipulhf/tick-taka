/**
 * Category and area guessing for quick-add, shared by the money, task and time
 * parsers: learned rules first, then the built-in keywords, then names.
 */

import { DEFAULT_AREAS, DEFAULT_CATEGORIES } from "./defaults";
import type { QuickAddContext } from "./quick-add";

export const normalize = (value: string) => value.trim().toLowerCase();

function categoryIdByName(name: string, context: QuickAddContext): string | null {
  return context.categories.find((c) => normalize(c.name) === normalize(name))?.id ?? null;
}

/**
 * Whole-word match that understands Bangla: vowel signs are part of a word, so "চা"
 * does not match inside "চাল". Both sides are NFC-normalised because keyboards emit
 * "ড়" and "য়" either precomposed or as a base letter plus nukta.
 */
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{M}\\p{N}_])${escaped}(?![\\p{L}\\p{M}\\p{N}_])`, "iu").test(
    haystack.normalize("NFC"),
  );
}

/** True for letters outside the Latin script, e.g. Bangla. The AI reads those better. */
export function hasNonLatinLetters(text: string): boolean {
  return (text.match(/\p{L}/gu) ?? []).some((letter) => (letter.codePointAt(0) ?? 0) > 0x24f);
}

interface CategoryGuess {
  categoryId: string | null;
  areaId: string | null;
  kind: "expense" | "income" | null;
}

/** Learned rules win over built-in keywords, as with Copilot's learn-from-corrections. */
export function guessCategory(note: string, context: QuickAddContext): CategoryGuess {
  const text = normalize(note);
  if (!text) return { categoryId: null, areaId: null, kind: null };
  const rule = [...(context.rules ?? [])]
    .sort((a, b) => b.matchText.length - a.matchText.length)
    .find((r) => r.matchText && text.includes(normalize(r.matchText)));
  if (rule) {
    const category = context.categories.find((c) => c.id === rule.categoryId);
    return { categoryId: rule.categoryId, areaId: rule.areaId, kind: category?.kind ?? null };
  }
  for (const parent of DEFAULT_CATEGORIES) {
    for (const child of parent.children ?? []) {
      if (child.keywords.some((k) => containsWord(text, k))) {
        const id = categoryIdByName(child.name, context) ?? categoryIdByName(parent.name, context);
        if (id) return { categoryId: id, areaId: null, kind: parent.kind };
      }
    }
    if (parent.keywords.some((k) => containsWord(text, k))) {
      const id = categoryIdByName(parent.name, context);
      if (id) return { categoryId: id, areaId: null, kind: parent.kind };
    }
  }
  const direct = context.categories.find((c) => containsWord(text, c.name));
  return direct
    ? { categoryId: direct.id, areaId: null, kind: direct.kind }
    : { categoryId: null, areaId: null, kind: null };
}

export function guessArea(text: string, context: QuickAddContext): string | null {
  const lower = normalize(text);
  const named = context.areas.find((a) => containsWord(lower, a.name));
  if (named) return named.id;
  for (const area of DEFAULT_AREAS) {
    if (area.keywords.some((k) => containsWord(lower, k))) {
      const match = context.areas.find((a) => normalize(a.name) === normalize(area.name));
      if (match) return match.id;
    }
  }
  return null;
}

import { newId } from "@tick-taka/shared/ids";

/** The routine editor's list of steps. Pure, so it can be tested. */

export interface DraftStep {
  id?: string;
  title: string;
  minutes: number | null;
}

/** The list with one step moved `by` places, staying inside the list. */
export function moveStep<T>(list: T[], index: number, by: number): T[] {
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item === undefined) return list;
  next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item);
  return next;
}

/** What a save sends: named steps only, in order, each keeping its id. */
export function stepsBody(steps: DraftStep[], makeId: () => string = newId) {
  return steps
    .filter((s) => s.title.trim())
    .map((s, sort) => ({ id: s.id ?? makeId(), title: s.title.trim(), minutes: s.minutes, sort }));
}

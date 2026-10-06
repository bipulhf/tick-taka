/**
 * Returns `value`, or throws when it is missing. For lookups that can't miss by
 * construction (a row just inserted, an index inside the array's bounds), so a
 * broken assumption fails loudly at that spot instead of spreading `undefined`.
 */
export function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`Expected ${what} to exist`);
  return value;
}

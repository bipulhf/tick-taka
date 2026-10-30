/** The task's own values for every field a move changes, so Undo can put them back. */
export function previousFields<T extends object>(
  task: T,
  change: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(change)
      .filter((key) => key in task)
      .map((key) => [key, task[key as keyof T]]),
  );
}

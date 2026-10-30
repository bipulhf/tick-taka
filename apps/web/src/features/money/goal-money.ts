/** Pure rules behind the goals view and panel. */

/**
 * The account a jar contribution comes from: the one picked, unless it is the jar's
 * own account (money never moves from a jar into itself), else the first other one.
 */
export function contributionSource(
  jarAccountId: string | null | undefined,
  chosen: string | null | undefined,
  accounts: { id: string }[],
): string | undefined {
  if (chosen && chosen !== jarAccountId) return chosen;
  return accounts.find((a) => a.id !== jarAccountId)?.id;
}

/** A deadline is a day still ahead: today or earlier is refused. */
export function isFutureDeadline(date: string, today: string): boolean {
  return date > today;
}

/** A plain message stays this long. */
export const VISIBLE_MS = 5000;
/** An Undo needs time to notice and reach for. */
export const WITH_ACTION_MS = 8000;

/**
 * How long a snackbar stays, in ms, or null to keep it until it is used, dismissed
 * or replaced. Follows Android's "Time to take action" setting (recommendedMs) and
 * never times out an action while a screen reader is on (WCAG 2.2.1).
 */
export function snackDuration(options: {
  hasAction: boolean;
  screenReaderOn: boolean;
  recommendedMs: number;
}): number | null {
  if (options.hasAction && options.screenReaderOn) return null;
  const base = options.hasAction ? WITH_ACTION_MS : VISIBLE_MS;
  return Math.max(base, options.recommendedMs);
}

/** What a screen reader hears: the message, and that an action is there to take. */
export function snackAnnouncement(message: string, actionLabel?: string): string {
  if (!actionLabel) return message;
  return `${message.replace(/[.!]$/, "")}. ${actionLabel} available.`;
}

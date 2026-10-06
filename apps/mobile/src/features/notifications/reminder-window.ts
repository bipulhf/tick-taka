/**
 * Which tasks to fetch for phone-scheduled reminders: every open or inbox task
 * (subtasks too) whose reminder rings in the next eight days, picked by
 * reminderAt rather than doAt, so an undated inbox task with a reminder still
 * rings. One day more than planNotifications' seven-day horizon covers a slow
 * week between app opens. Pure, so it can be tested.
 */
export const REMINDER_LOOKAHEAD_MS = 8 * 86_400_000;

export function reminderQuery(now: number) {
  return {
    status: "inbox,open",
    reminderFrom: String(now),
    reminderTo: String(now + REMINDER_LOOKAHEAD_MS),
    includeSubtasks: "true" as const,
    limit: "500",
  };
}

/** Coming back to the app reschedules, but not more than once every few minutes. */
export const RESCHEDULE_GAP_MS = 5 * 60_000;

export function rescheduleDue(lastRunAt: number | null, now: number): boolean {
  return lastRunAt === null || now - lastRunAt >= RESCHEDULE_GAP_MS;
}

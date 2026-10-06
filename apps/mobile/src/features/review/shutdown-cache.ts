/**
 * Optimistic edits to the cached shutdown screen, so a tick shows at once (and
 * offline) and agrees with what the server sends back on the next refetch. Pure.
 */

interface ShutdownLike {
  habitsUnchecked: { id: string }[];
  tomorrowTopThree: { id: string; top3Date: string | null }[];
  tomorrowCandidates: { id: string; top3Date: string | null }[];
}

type Habit<D extends ShutdownLike> = D["habitsUnchecked"][number];

/** A habit ticked off for today leaves the unchecked list. */
export function withHabitTicked<D extends ShutdownLike>(data: D, habitId: string): D {
  return { ...data, habitsUnchecked: data.habitsUnchecked.filter((h) => h.id !== habitId) };
}

/** Unticking puts the habit back. */
export function withHabitUnticked<D extends ShutdownLike>(data: D, habit: Habit<D>): D {
  if (data.habitsUnchecked.some((h) => h.id === habit.id)) return data;
  return { ...data, habitsUnchecked: [...data.habitsUnchecked, habit] };
}

/** A candidate picked for tomorrow's top three; never more than three. */
export function withTopPicked<D extends ShutdownLike>(
  data: D,
  taskId: string,
  tomorrow: string,
): D {
  const task = data.tomorrowCandidates.find((t) => t.id === taskId);
  if (!task || data.tomorrowTopThree.length >= 3) return data;
  return {
    ...data,
    tomorrowTopThree: [...data.tomorrowTopThree, { ...task, top3Date: tomorrow }],
    tomorrowCandidates: data.tomorrowCandidates.filter((t) => t.id !== taskId),
  };
}

/** Unpicking sends the task back to the top of the candidates. */
export function withTopUnpicked<D extends ShutdownLike>(data: D, taskId: string): D {
  const task = data.tomorrowTopThree.find((t) => t.id === taskId);
  if (!task) return data;
  return {
    ...data,
    tomorrowTopThree: data.tomorrowTopThree.filter((t) => t.id !== taskId),
    tomorrowCandidates: [{ ...task, top3Date: null }, ...data.tomorrowCandidates],
  };
}

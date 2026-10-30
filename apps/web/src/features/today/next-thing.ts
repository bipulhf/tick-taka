/**
 * The one task Today's header names as "what now". Pure, so it can be tested.
 * Order: the next timed task (one that started up to 30 minutes ago still counts),
 * then the first unfinished top-three task, then the first open task of the day.
 */

interface TaskLike {
  id: string;
  title: string;
  status: string;
}

interface DayLike {
  topThree: TaskLike[];
  timeline: ({ kind: "task"; at: number | null; task: TaskLike } | { kind: string })[];
}

export interface NextThing {
  id: string;
  title: string;
  at: number | null;
}

const GRACE_MS = 30 * 60_000;
const open = (task: TaskLike) => task.status !== "done" && task.status !== "someday";

export function nextThing(data: DayLike, now: number): NextThing | null {
  const tasks = data.timeline.flatMap((item) =>
    item.kind === "task" && "task" in item && open(item.task) ? [item] : [],
  );
  const timed = tasks.find((item) => item.at !== null && item.at >= now - GRACE_MS);
  if (timed) return { id: timed.task.id, title: timed.task.title, at: timed.at };
  const top = data.topThree.find(open);
  if (top) return { id: top.id, title: top.title, at: null };
  const untimed = tasks.find((item) => item.at === null);
  return untimed ? { id: untimed.task.id, title: untimed.task.title, at: null } : null;
}

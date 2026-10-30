import type { PlanTask } from "./queries";

/** The Eisenhower grid's boxes and what moving into one changes. Pure. */

export const QUADRANTS = [
  {
    id: "do",
    title: "Do now",
    hint: "Urgent · important",
    urgent: true,
    important: true,
    tone: "text-ink",
  },
  {
    id: "plan",
    title: "Schedule",
    hint: "Important, not urgent",
    urgent: false,
    important: true,
    tone: "text-sky-text",
  },
  {
    id: "delegate",
    title: "Squeeze in",
    hint: "Urgent, not important",
    urgent: true,
    important: false,
    tone: "text-muted",
  },
  {
    id: "drop",
    title: "Drop",
    hint: "Neither",
    urgent: false,
    important: false,
    tone: "text-muted",
  },
] as const;

type Quadrant = (typeof QUADRANTS)[number];

/** What moving a task into a quadrant changes: urgent, and importance through priority. */
export function quadrantChange(task: Pick<PlanTask, "priority">, quadrant: Quadrant) {
  return {
    urgent: quadrant.urgent,
    priority: quadrant.important
      ? ("high" as const)
      : task.priority === "high"
        ? ("normal" as const)
        : task.priority,
  };
}

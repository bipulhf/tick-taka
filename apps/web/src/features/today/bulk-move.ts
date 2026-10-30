import { z } from "zod";
import type { WriteRequest } from "@/lib/write";

/**
 * Today's two bulk moves ("bring old tasks into today", "move low-priority tasks
 * to tomorrow") are decided by the server. Its reply lists each task as it was
 * before, so the toast can name them and Undo can put them back. Pure.
 */

const beforeSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  doAt: z.number().nullable(),
  hasTime: z.boolean(),
  reminderAt: z.number().nullable(),
  top3Date: z.string().nullable(),
});

export type TaskBefore = z.infer<typeof beforeSchema>;

const replySchema = z.object({ before: z.array(beforeSchema) });

/** The moved tasks' earlier state from a bulk-move reply; [] if the reply has none. */
export function movedBefore(reply: unknown): TaskBefore[] {
  const parsed = replySchema.safeParse(reply);
  return parsed.success ? parsed.data.before : [];
}

const quote = (title: string) => `“${title.length > 28 ? `${title.slice(0, 27)}…` : title}”`;

/** "Moved “Call bank”, “Read” and 2 more to tomorrow". */
export function movedMessage(before: TaskBefore[], where: string): string {
  const titles = before.map((task) => quote(task.title));
  if (titles.length === 0) return "Nothing needed moving";
  if (titles.length === 1) return `Moved ${titles[0]} to ${where}`;
  if (titles.length === 2) return `Moved ${titles[0]} and ${titles[1]} to ${where}`;
  return `Moved ${titles[0]}, ${titles[1]} and ${titles.length - 2} more to ${where}`;
}

/** Puts every moved task back where it was; the server stamps the edit time. */
export function undoMoves(before: TaskBefore[]): WriteRequest[] {
  return before.map((task) => ({
    method: "PATCH",
    path: `/tasks/${task.id}`,
    body: {
      status: task.status,
      doAt: task.doAt,
      hasTime: task.hasTime,
      reminderAt: task.reminderAt,
      top3Date: task.top3Date,
    },
    label: "Couldn't undo the move",
  }));
}

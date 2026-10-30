import { notify } from "@/lib/toast";
import { fire } from "@/lib/write";

/** Archives a habit (hides it, keeps its history), with Undo in the toast. */
export function archiveHabit(habit: { id: string; name: string }, archived = true) {
  fire({
    method: "PATCH",
    path: `/habits/${habit.id}`,
    body: { archived },
    label: `Couldn't ${archived ? "archive" : "restore"} ${habit.name}`,
  });
  notify(archived ? `Archived ${habit.name}` : `Restored ${habit.name}`, {
    label: "Undo",
    onPress: () =>
      fire({
        method: "PATCH",
        path: `/habits/${habit.id}`,
        body: { archived: !archived },
        label: "Couldn't undo",
      }),
  });
}

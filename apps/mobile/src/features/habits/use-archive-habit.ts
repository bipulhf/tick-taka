import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";

/** Archives a habit (hides it, keeps its history), with Undo in the snackbar. */
export function useArchiveHabit() {
  const send = useOutbox();
  return (habit: { id: string; name: string }) => {
    send({ method: "PATCH", path: `/habits/${habit.id}`, body: { archived: true } });
    notify(`Archived ${habit.name}`, {
      label: "Undo",
      onPress: () =>
        send({
          method: "PATCH",
          path: `/habits/${habit.id}`,
          body: { archived: false },
        }),
    });
  };
}

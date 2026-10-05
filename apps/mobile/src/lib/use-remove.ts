import { haptic } from "./haptics";
import { notify } from "./notify";
import { useOutbox } from "./outbox";

/**
 * Deletes one record with Undo in the snackbar instead of an "Are you sure?"
 * dialog. `path` is the record's route, e.g. `/goals/<id>`; every such route has
 * a matching `POST <path>/restore`.
 */
export function useRemove() {
  const send = useOutbox();
  return (path: string, name: string) => {
    send({ method: "DELETE", path, label: "Couldn't delete" });
    haptic.tap();
    notify(`Deleted ${name}`, {
      label: "Undo",
      onPress: () => send({ method: "POST", path: `${path}/restore`, label: "Couldn't undo" }),
    });
  };
}

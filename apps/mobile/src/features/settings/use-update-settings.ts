import { useQueryClient } from "@tanstack/react-query";
import type { SettingsPatch } from "@tick-taka/shared/schemas/settings";
import { useOutbox } from "@/lib/outbox";
import { keys } from "@/lib/queries";

/** Optimistically applies a settings change and queues the PATCH. */
export function useUpdateSettings() {
  const client = useQueryClient();
  const send = useOutbox();
  return (patch: SettingsPatch) => {
    client.setQueryData(keys.settings, (current: object | undefined) =>
      current ? { ...current, ...patch } : current,
    );
    send({ method: "PATCH", path: "/settings", body: patch, label: "Couldn't save the setting" });
  };
}

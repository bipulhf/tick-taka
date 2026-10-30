import { useQueryClient } from "@tanstack/react-query";
import type { SettingsPatch } from "@tick-taka/shared/schemas/settings";
import { useCallback } from "react";
import { keys } from "@/lib/queries";
import { fire } from "@/lib/write";

/**
 * Applies a settings change at once and sends the PATCH. A refused save says so in
 * a toast with Retry, and the refresh after it puts the server's value back.
 */
export function useUpdateSettings() {
  const client = useQueryClient();
  return useCallback(
    (patch: SettingsPatch) => {
      client.setQueryData(keys.settings, (current: object | undefined) =>
        current ? { ...current, ...patch } : current,
      );
      fire({ method: "PATCH", path: "/settings", body: patch, label: "Couldn't save the setting" });
    },
    [client],
  );
}

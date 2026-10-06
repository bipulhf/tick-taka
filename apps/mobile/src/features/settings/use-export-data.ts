import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { send } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { notify } from "@/lib/notify";

/** Downloads the full JSON export and opens the share sheet to save it. */
export function useExportData() {
  const [busy, setBusy] = useState(false);
  const exportData = async () => {
    setBusy(true);
    try {
      const data = await send("GET", "/export");
      const stamp = new Date().toISOString().slice(0, 10);
      const file = new File(Paths.cache, `tick-taka-export-${stamp}.json`);
      file.create({ overwrite: true });
      file.write(JSON.stringify(data));
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Save your Tick & Taka export",
      });
    } catch (error) {
      notify(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };
  return { busy, exportData };
}

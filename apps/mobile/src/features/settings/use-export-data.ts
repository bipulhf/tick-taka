import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { send } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { exportFileName } from "@/lib/export-file";
import { notify } from "@/lib/notify";

/** Downloads the full JSON export and opens the share sheet to save it. */
export function useExportData() {
  const [busy, setBusy] = useState(false);
  const exportData = async () => {
    setBusy(true);
    let file: File | null = null;
    try {
      const data = await send("GET", "/export");
      file = new File(Paths.cache, exportFileName(new Date()));
      file.create({ overwrite: true });
      file.write(JSON.stringify(data));
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Save your Tick & Taka export",
      });
    } catch (error) {
      notify(friendlyError(error));
    } finally {
      // The share sheet has its copy; a plain-text copy of everything stays nowhere else.
      try {
        if (file?.exists) file.delete();
      } catch (error) {
        console.warn("export: couldn't delete the shared file", error);
      }
      setBusy(false);
    }
  };
  return { busy, exportData };
}

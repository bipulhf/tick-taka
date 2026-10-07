import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { send } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { EXPORT_KEEP_MS, exportFileName } from "@/lib/export-file";
import { sweepExports } from "@/lib/export-sweep";
import { notify } from "@/lib/notify";

/**
 * Downloads the full JSON export and opens the share sheet to save it. The file stays
 * in the cache folder for a while after the sheet returns, because the app it went to
 * may read it later; older exports are swept at start, before the next export and on
 * sign-out. `shared` turns true once the sheet has been opened with an export.
 */
export function useExportData() {
  const [busy, setBusy] = useState(false);
  const [shared, setShared] = useState(false);
  const exportData = async () => {
    setBusy(true);
    try {
      sweepExports(EXPORT_KEEP_MS);
      const data = await send("GET", "/export");
      const file = new File(Paths.cache, exportFileName(new Date()));
      file.create({ overwrite: true });
      file.write(JSON.stringify(data));
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Save your Tick & Taka export",
      });
      setShared(true);
    } catch (error) {
      notify(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };
  return { busy, shared, exportData };
}

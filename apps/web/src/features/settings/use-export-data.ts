import { useState } from "react";
import { apiErrorFrom } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { apiUrl, request } from "@/lib/http";
import { notifyError } from "@/lib/toast";
import { exportFileName } from "./delete-account-rules";

/**
 * Downloads the full JSON export (GET /export, streamed by the server) straight to
 * a file. `downloaded` turns true once a file has been handed to the browser.
 */
export function useExportData() {
  const [busy, setBusy] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const exportData = async () => {
    setBusy(true);
    try {
      const response = await request(apiUrl("/export"), { timeout: 120_000 });
      if (!response.ok)
        throw apiErrorFrom(response.status, await response.json().catch(() => null));
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName(new Date());
      document.body.append(link);
      link.click();
      link.remove();
      // The download has its own copy by now; the blob can go.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDownloaded(true);
    } catch (error) {
      notifyError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };
  return { busy, downloaded, exportData: () => void exportData() };
}

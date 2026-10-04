import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { send } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { queryClient } from "@/lib/query-client";

/** Export downloads the full JSON to the phone: the only copy outside the server. */
export function DataSection() {
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
      notify((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="gap-3">
      <Text tone="muted">Your data lives on your server. Export a copy now and then.</Text>
      <Button
        label="Export all data"
        icon="download"
        variant="secondary"
        loading={busy}
        onPress={exportData}
      />
      <Button
        label="Sign out"
        variant="ghost"
        onPress={async () => {
          await signOut();
          queryClient.clear();
        }}
      />
    </Card>
  );
}

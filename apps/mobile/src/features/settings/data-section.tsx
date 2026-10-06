import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { useExportData } from "./use-export-data";

/** Export downloads the full JSON to the phone: the only copy outside the server. */
export function DataSection() {
  const { busy, exportData } = useExportData();
  return (
    <Card className="gap-3">
      <Text tone="muted">
        Your data lives on the server, apart from everyone else's. Export a copy now and then.
      </Text>
      <Button
        label="Export all data"
        icon="download"
        variant="secondary"
        loading={busy}
        onPress={exportData}
      />
    </Card>
  );
}

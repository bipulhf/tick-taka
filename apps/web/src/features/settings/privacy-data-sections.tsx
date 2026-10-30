import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { ToggleRow } from "@/components/ui/toggle";
import { togglePrivacy, usePrivacy } from "@/lib/prefs";
import { useExportData } from "./use-export-data";

/** Privacy mode: one switch hides every amount on screen. */
export function PrivacySection() {
  const hidden = usePrivacy();
  return (
    <Section id="settings-privacy" title="Privacy">
      <Group>
        <ToggleRow
          label="Hide amounts"
          description="Hide every amount on screen. Shift H does it from anywhere."
          checked={hidden}
          onChange={togglePrivacy}
        />
      </Group>
    </Section>
  );
}

/** Export downloads the full JSON: the only copy outside the server. */
export function DataSection() {
  const { busy, exportData } = useExportData();
  return (
    <Section id="settings-data" title="Data">
      <div className="flex flex-col items-start gap-3 rounded-2xl bg-card p-4">
        <p className="text-body text-muted">
          Your data lives on the server, apart from everyone else's. Export a copy now and then.
        </p>
        <Button icon={Download} loading={busy} onClick={exportData}>
          Export all data
        </Button>
      </div>
    </Section>
  );
}

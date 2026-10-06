import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { ChoiceRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

export const ACCENTS = [
  { id: null, label: "Classic" },
  { id: "mint-breeze", label: "Mint breeze" },
  { id: "grape-dusk", label: "Grape dusk" },
];
const OUTFITS = [
  { id: null, label: "None" },
  { id: "cap", label: "🧢 Cap" },
  { id: "scarf", label: "🧣 Scarf" },
  { id: "crown", label: "👑 Crown" },
];

/** Theme, accent colour and Tiki's outfit. */
export function AppearanceSettings() {
  const update = useUpdateSettings();
  return (
    <SettingsPage title="Appearance">
      {(s) => (
        <>
          <Segmented<"system" | "light" | "dark">
            value={s.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
          <Card className="gap-1">
            <ChoiceRow label="Accent">
              {ACCENTS.map((accent) => (
                <Chip
                  key={accent.label}
                  label={accent.label}
                  selected={(s.rewardTheme ?? null) === accent.id}
                  onPress={() => update({ rewardTheme: accent.id })}
                />
              ))}
            </ChoiceRow>
            <ChoiceRow label="Tiki's outfit">
              {OUTFITS.map((outfit) => (
                <Chip
                  key={outfit.label}
                  label={outfit.label}
                  selected={(s.tikiOutfit ?? null) === outfit.id}
                  onPress={() => update({ tikiOutfit: outfit.id })}
                />
              ))}
            </ChoiceRow>
          </Card>
        </>
      )}
    </SettingsPage>
  );
}

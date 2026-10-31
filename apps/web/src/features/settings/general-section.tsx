import { Keyboard } from "lucide-react";
import { Group, Row, RowMark } from "@/components/ui/group";
import { Kbd } from "@/components/ui/kbd";
import { Section } from "@/components/ui/section";
import { NONE } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/toggle";
import { formatAmount } from "@/lib/format";
import { setFeedbackPrefs, useFeedbackPrefs } from "@/lib/prefs";
import { shortcutsOpenStore } from "@/lib/ui-state";
import { SelectRow } from "./setting-row";
import type { SectionProps } from "./settings-types";

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

const choices = (list: { id: string | null; label: string }[]) =>
  list.map((item) => ({ value: item.id ?? NONE, label: item.label }));

/** Theme, digits for amounts, accent colour, Tiki's outfit and sounds. */
export function AppearanceSection({ s, update }: SectionProps) {
  const feedback = useFeedbackPrefs();
  return (
    <Section id="settings-appearance" title="Appearance">
      <Group>
        <SelectRow<"system" | "light" | "dark">
          label="Theme"
          value={s.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
        <SelectRow<"latn" | "beng">
          label="Numbers"
          description={`How amounts are shown, like ${formatAmount(125_000, { numerals: s.numerals })}. Dates and times stay 0-9. You can type either.`}
          value={s.numerals}
          onChange={(numerals) => update({ numerals })}
          options={[
            { value: "latn", label: "English 123" },
            { value: "beng", label: "বাংলা ১২৩" },
          ]}
        />
        <SelectRow
          label="Accent"
          value={s.rewardTheme ?? NONE}
          options={choices(ACCENTS)}
          onChange={(id) => update({ rewardTheme: id === NONE ? null : id })}
        />
        <SelectRow
          label="Tiki's outfit"
          value={s.tikiOutfit ?? NONE}
          options={choices(OUTFITS)}
          onChange={(id) => update({ tikiOutfit: id === NONE ? null : id })}
        />
        <ToggleRow
          label="Sounds"
          description="A soft chime when you finish something"
          checked={feedback.sounds}
          onChange={(on) => setFeedbackPrefs({ sounds: on })}
        />
        <Row
          leading={<RowMark icon={Keyboard} />}
          title="Keyboard shortcuts"
          subtitle="Every key that works in the app"
          trailing={<Kbd>?</Kbd>}
          onClick={() => shortcutsOpenStore.set(true)}
        />
      </Group>
    </Section>
  );
}

import { Compass, Keyboard } from "lucide-react";
import { Group, Row, RowMark } from "@/components/ui/group";
import { Kbd } from "@/components/ui/kbd";
import { Segmented } from "@/components/ui/segmented";
import { NONE } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/toggle";
import { formatAmount } from "@/lib/format";
import { setFeedbackPrefs, togglePrivacy, useFeedbackPrefs, usePrivacy } from "@/lib/prefs";
import { shortcutsOpenStore } from "@/lib/ui-state";
import { startTour } from "../tour/tour-store";
import { GroupLabel, SelectRow, SettingRow } from "./setting-row";
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

/**
 * How the app looks and sounds, and hiding amounts. Light or dark isn't here: the
 * top bar's button switches it for this browser.
 */
export function GeneralSection({ s, update }: SectionProps) {
  const feedback = useFeedbackPrefs();
  const hidden = usePrivacy();
  return (
    <>
      <Group>
        <SettingRow
          label="Numbers"
          description={`Amounts show like ${formatAmount(125_000, { numerals: s.numerals })}. You can type either.`}
        >
          <Segmented<"latn" | "beng">
            label="Numbers"
            value={s.numerals}
            onChange={(numerals) => update({ numerals })}
            options={[
              { value: "latn", label: "English 123" },
              { value: "beng", label: "বাংলা ১২৩" },
            ]}
          />
        </SettingRow>
        <SelectRow
          label="Accent"
          description="A tint for the background"
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
      </Group>

      <GroupLabel>This browser</GroupLabel>
      <Group>
        <ToggleRow
          label="Sounds"
          description="A soft chime when you finish something"
          checked={feedback.sounds}
          onChange={(on) => setFeedbackPrefs({ sounds: on })}
        />
        <ToggleRow
          label="Hide amounts"
          description="Every amount shows as ৳•••. Shift H does it from anywhere."
          checked={hidden}
          onChange={togglePrivacy}
        />
        <Row
          leading={<RowMark icon={Keyboard} />}
          title="Keyboard shortcuts"
          subtitle="Every key that works in the app"
          trailing={<Kbd>?</Kbd>}
          onClick={() => shortcutsOpenStore.set(true)}
        />
        <Row
          leading={<RowMark icon={Compass} />}
          title="Take the tour again"
          subtitle="Tiki shows you around the app in about a minute"
          onClick={startTour}
          chevron
        />
      </Group>
    </>
  );
}

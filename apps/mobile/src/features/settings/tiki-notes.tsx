import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Group } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { keys } from "@/lib/queries";
import { useUpdateSettings } from "./use-update-settings";

/** As many as the server keeps, each as long as it allows. */
const MAX_NOTES = 30;
const NOTE_LENGTH = 200;

/**
 * What Tiki remembers: the notes it reads before every chat ("I get paid on the
 * 25th"). Forget one with Undo, or add one here instead of in the chat. Writes go
 * through the outbox like every other setting, so this works offline too.
 */
export function TikiNotes({ notes }: { notes: string[] }) {
  const client = useQueryClient();
  const update = useUpdateSettings();
  const [draft, setDraft] = useState("");
  // The list as it is now, not as it was when this rendered (an Undo comes later).
  const current = () =>
    client.getQueryData<{ tikiNotes?: string[] }>(keys.settings)?.tikiNotes ?? notes;

  const add = () => {
    const note = draft.replace(/\s+/g, " ").trim().slice(0, NOTE_LENGTH);
    const list = current();
    if (!note || list.length >= MAX_NOTES) return;
    if (!list.some((kept) => kept.toLowerCase() === note.toLowerCase()))
      update({ tikiNotes: [...list, note] });
    setDraft("");
    haptic.success();
  };

  const forget = (index: number) => {
    const list = current();
    const note = list[index];
    if (note === undefined) return;
    update({ tikiNotes: list.filter((_, i) => i !== index) });
    haptic.tap();
    notify(`Forgot “${note}”`, {
      label: "Undo",
      onPress: () => {
        const now = current();
        if (now.includes(note)) return;
        update({ tikiNotes: [...now.slice(0, index), note, ...now.slice(index)] });
      },
    });
  };

  const full = notes.length >= MAX_NOTES;
  return (
    <Section title="What Tiki remembers">
      <Text variant="callout" tone="muted" className="px-1">
        Tiki reads these before every chat. Say “remember that…” in the chat, or add one here.
      </Text>
      {notes.length ? (
        <Group>
          {notes.map((note, index) => (
            <View key={note} className="min-h-[60px] flex-row items-center gap-2 py-2 pl-4 pr-1">
              <Text className="flex-1">{note}</Text>
              <IconButton
                icon="close"
                label={`Forget “${note}”`}
                color="muted"
                onPress={() => forget(index)}
              />
            </View>
          ))}
        </Group>
      ) : (
        <Text tone="muted" className="px-1">
          Nothing yet.
        </Text>
      )}
      {full ? (
        <Text variant="caption" tone="muted" className="px-1">
          Tiki can remember {MAX_NOTES} things. Forget one to add another.
        </Text>
      ) : (
        <View className="flex-row items-start gap-2">
          <TextField
            value={draft}
            onChangeText={setDraft}
            placeholder="Something to remember"
            maxLength={NOTE_LENGTH}
            returnKeyType="done"
            onSubmitEditing={add}
            className="flex-1"
          />
          <Button label="Add" variant="secondary" disabled={!draft.trim()} onPress={add} />
        </View>
      )}
    </Section>
  );
}

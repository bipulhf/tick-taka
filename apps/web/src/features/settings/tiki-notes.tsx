import { Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Group, Row, RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { TextField } from "@/components/ui/text-field";
import { notify } from "@/lib/toast";
import type { SectionProps } from "./settings-types";

const MAX_NOTES = 30;
const NOTE_LENGTH = 200;

/**
 * "What Tiki remembers": notes the user asked Tiki to keep in mind (in the chat, or
 * added here), read with every message. Forgetting one has Undo.
 */
export function TikiNotes({ s, update }: SectionProps) {
  const notes = s.tikiNotes ?? [];
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const full = notes.length >= MAX_NOTES;

  const add = () => {
    const note = draft.trim().slice(0, NOTE_LENGTH);
    if (!note) return;
    if (notes.some((kept) => kept.toLowerCase() === note.toLowerCase())) {
      setError("Tiki already remembers that.");
      return;
    }
    update({ tikiNotes: [...notes, note] });
    setDraft("");
    setError(null);
  };
  const forget = (index: number) => {
    const before = notes;
    update({ tikiNotes: notes.filter((_, i) => i !== index) });
    notify(`Forgot “${notes[index]}”`, {
      label: "Undo",
      onPress: () => update({ tikiNotes: before }),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-1">
        <h3 className="text-body font-bold">What Tiki remembers</h3>
        <p className="text-callout text-muted">
          Say “remember that…” in the chat, or add a note here. Tiki reads these with every message.
        </p>
      </div>
      {notes.length ? (
        <Group as="ul" label="What Tiki remembers">
          {notes.map((note, index) => (
            <Row
              // biome-ignore lint/suspicious/noArrayIndexKey: notes are plain text and may repeat in case only.
              key={`${note}-${index}`}
              as="li"
              leading={<RowMark icon={Lightbulb} size="sm" />}
              title={<span className="whitespace-normal">{note}</span>}
              trailing={
                <IconButton
                  icon={X}
                  size="sm"
                  label={`Forget “${note}”`}
                  onClick={() => forget(index)}
                />
              }
            />
          ))}
        </Group>
      ) : (
        <p className="px-1 text-callout text-muted">Nothing yet.</p>
      )}
      <form
        className="flex items-start gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
      >
        <TextField
          aria-label="A note for Tiki"
          placeholder={full ? "Tiki keeps up to 30 notes" : "e.g. My salary comes on the 5th"}
          value={draft}
          maxLength={NOTE_LENGTH}
          disabled={full}
          error={error}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={full || !draft.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

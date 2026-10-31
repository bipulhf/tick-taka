import { useNavigate } from "@tanstack/react-router";
import { parseTypedInteger } from "@tick-taka/shared/digits";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { TextField } from "@/components/ui/text-field";
import { remove, write } from "@/lib/write";
import type { Routine } from "./queries";
import { type DraftStep, moveStep, stepsBody } from "./routine-steps";

/** A routine's name, emoji and steps, edited in place; Save sends them all at once. */
export function RoutineEditor({ routine, onDone }: { routine: Routine; onDone: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(routine.name);
  const [emoji, setEmoji] = useState(routine.emoji);
  const [steps, setSteps] = useState<DraftStep[]>(
    routine.steps.map((s) => ({ id: s.id, title: s.title, minutes: s.minutes })),
  );
  const [saving, setSaving] = useState(false);
  const update = (index: number, patch: Partial<DraftStep>) =>
    setSteps((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  const save = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      await write({
        method: "PATCH",
        path: `/routines/${routine.id}`,
        body: { name: name.trim(), emoji: emoji.trim() || routine.emoji, steps: stepsBody(steps) },
        label: "Couldn't save the routine",
      });
      onDone();
    } catch {
      // The toast said why; the edits stay.
      setSaving(false);
    }
  };

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex gap-2">
        <TextField
          aria-label="Emoji"
          value={emoji}
          onChange={(event) => setEmoji(event.target.value)}
          className="w-16"
        />
        <TextField
          aria-label="Routine name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="flex-1"
        />
      </div>
      <ol aria-label="Steps" className="flex flex-col gap-2">
        {steps.map((step, index) => (
          <li
            key={step.id ?? `new-${index}`}
            className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-2"
          >
            <span aria-hidden className="w-6 text-center text-caption text-muted tabular">
              {index + 1}
            </span>
            <TextField
              aria-label={`Step ${index + 1}`}
              value={step.title}
              placeholder="What to do"
              autoFocus={!step.id && index === steps.length - 1 && !step.title}
              onChange={(event) => update(index, { title: event.target.value })}
              className="min-w-0 flex-1 basis-[calc(100%-2.5rem)] sm:basis-0"
            />
            <TextField
              aria-label={`Minutes for step ${index + 1}`}
              value={step.minutes ? String(step.minutes) : ""}
              placeholder="min"
              inputMode="numeric"
              onChange={(event) =>
                update(index, { minutes: parseTypedInteger(event.target.value) || null })
              }
              className="w-20"
            />
            <IconButton
              icon={ChevronUp}
              size="sm"
              label={`Move step ${index + 1} up`}
              disabled={index === 0}
              onClick={() => setSteps((list) => moveStep(list, index, -1))}
            />
            <IconButton
              icon={ChevronDown}
              size="sm"
              label={`Move step ${index + 1} down`}
              disabled={index === steps.length - 1}
              onClick={() => setSteps((list) => moveStep(list, index, 1))}
            />
            <IconButton
              icon={X}
              size="sm"
              label={`Remove step ${index + 1}`}
              onClick={() => setSteps((list) => list.filter((_, i) => i !== index))}
            />
          </li>
        ))}
      </ol>
      <Button
        icon={Plus}
        className="self-start"
        onClick={() => setSteps([...steps, { title: "", minutes: null }])}
      >
        Add step
      </Button>
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-5">
        <Button type="submit" variant="primary" loading={saving} disabled={!name.trim()}>
          Save routine
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button
          variant="danger"
          icon={Trash2}
          className="ml-auto"
          onClick={() => {
            void remove(`/routines/${routine.id}`, `“${routine.name}”`).catch(() => {});
            void navigate({ to: "/plan/routines" });
          }}
        >
          Delete routine
        </Button>
      </div>
    </form>
  );
}

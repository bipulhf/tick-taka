import { parseTypedInteger } from "@tick-taka/shared/digits";
import { newId } from "@tick-taka/shared/ids";
import { Archive, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { ErrorState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { NONE, Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Field, TextField } from "@/components/ui/text-field";
import { formatClock } from "@/lib/format";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { HabitHistory } from "./habit-history";
import type { Schedule } from "./habit-progress";
import { type HabitWithProgress, useHabits } from "./queries";
import { archiveHabit } from "./use-archive-habit";

const EMOJIS = ["💧", "🏃", "📖", "🧘", "🥗", "😴", "✍️", "🙏", "💪", "🎸"];
const REMIND = ["07:00", "09:00", "13:00", "18:00", "21:00"];
const perWeekLabel = (n: number | string) => `${n}× a week`;
/** "18:00" as "6:00 pm", the way every time reads in the app. */
const clockLabel = (clock: string) => {
  const [h = 0, m = 0] = clock.split(":").map(Number);
  return formatClock(Date.UTC(2026, 0, 1, h, m), "UTC");
};

/** `?panel=habit:<id>` edits a habit and shows its history; `habit:new` adds one. */
export function HabitPanel({ id, onClose }: PanelComponentProps) {
  const habits = useHabits({ archived: true });
  const editing = id !== "new";
  const habit = editing ? habits.data?.find((h) => h.id === id) : undefined;
  if (editing && !habit)
    return (
      <Panel open onClose={onClose} title="Habit">
        {habits.isError || habits.data ? (
          <ErrorState
            onRetry={() => void habits.refetch()}
            message={habits.data ? "That habit is no longer here." : undefined}
          />
        ) : (
          <SkeletonRows rows={4} />
        )}
      </Panel>
    );
  return <HabitForm habit={habit ?? null} onClose={onClose} />;
}

function HabitForm({ habit, onClose }: { habit: HabitWithProgress | null; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? "💧");
  // Habits are always grape on screen (purple means habits); the emoji gives each its identity.
  const color = habit?.color ?? "#A57BFF";
  const [schedule, setSchedule] = useState<Schedule>(habit?.schedule ?? "daily");
  const [perWeek, setPerWeek] = useState(habit?.perWeek ?? 3);
  const [target, setTarget] = useState(String(habit?.targetCount ?? 1));
  const [remindAt, setRemindAt] = useState<string | null>(habit?.remindAt ?? null);
  const [saving, setSaving] = useState(false);
  const targetCount = Math.max(1, Math.min(100, parseTypedInteger(target) || 1));
  const [initial] = useState(() =>
    JSON.stringify([name, emoji, schedule, perWeek, target, remindAt]),
  );
  const dirty = JSON.stringify([name, emoji, schedule, perWeek, target, remindAt]) !== initial;

  const save = async () => {
    if (!name.trim() || saving) return;
    const body = {
      name: name.trim(),
      emoji,
      color,
      schedule,
      perWeek: schedule === "n_per_week" ? perWeek : null,
      targetCount,
      remindAt,
    };
    setSaving(true);
    try {
      if (habit)
        await write({
          method: "PATCH",
          path: `/habits/${habit.id}`,
          body,
          label: "Couldn't save the habit",
        });
      else
        await write({
          method: "POST",
          path: "/habits",
          body: { id: newId(), ...body },
          label: "Couldn't save the habit",
        });
      onClose();
    } catch {
      // The toast said why; what was typed stays.
      setSaving(false);
    }
  };

  const perWeekOptions = [2, 3, 4, 5, 6].includes(perWeek)
    ? [2, 3, 4, 5, 6]
    : [perWeek, 2, 3, 4, 5, 6];
  return (
    <Panel
      open
      onClose={onClose}
      title={habit ? "Edit habit" : "New habit"}
      dirty={dirty && !saving}
      headerActions={
        habit ? (
          <IconButton
            icon={Trash2}
            label="Delete habit"
            onClick={() => {
              void remove(`/habits/${habit.id}`, `“${habit.name}”`).catch(() => {});
              onClose();
            }}
          />
        ) : null
      }
      footer={
        <>
          {habit && habit.archivedAt === null ? (
            <Button
              icon={Archive}
              onClick={() => {
                archiveHabit(habit);
                onClose();
              }}
            >
              Archive
            </Button>
          ) : null}
          <Button
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!name.trim()}
            onClick={() => void save()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          aria-label="Habit name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Drink water"
          autoFocus={!habit}
          className="[&_input]:h-11 [&_input]:text-heading [&_input]:font-semibold"
        />
        <Field label="Emoji">
          <div role="radiogroup" aria-label="Emoji" className="grid grid-cols-5 gap-1.5">
            {EMOJIS.map((e) => (
              // biome-ignore lint/a11y/useSemanticElements: an emoji grid, styled as tiles
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji === e}
                aria-label={e}
                onClick={() => setEmoji(e)}
                className={cx(
                  "flex h-11 items-center justify-center rounded-xl text-heading transition-colors",
                  emoji === e ? "bg-ink/10 ring-2 ring-ink" : "hover:bg-line/60",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Schedule">
          <Segmented<Schedule>
            label="Schedule"
            value={schedule}
            onChange={setSchedule}
            className="w-full"
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
              { value: "n_per_week", label: "N a week" },
            ]}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          {schedule === "n_per_week" ? (
            <Select
              label="How often"
              value={String(perWeek)}
              onChange={(n) => setPerWeek(Number(n))}
              // Tiki can set 1 or 7 (the schema allows 1-7): it reads "7× a week", not "7".
              options={perWeekOptions.map((n) => ({ value: String(n), label: perWeekLabel(n) }))}
            />
          ) : null}
          <TextField
            label="Count per day (e.g. 8 glasses)"
            value={target}
            inputMode="numeric"
            onChange={(event) => setTarget(event.target.value)}
            className={schedule === "n_per_week" ? undefined : "col-span-2"}
          />
        </div>
        <Select
          label="Nudge me at"
          value={remindAt ?? NONE}
          onChange={(value) => setRemindAt(value === NONE ? null : value)}
          options={[
            { value: NONE, label: "No nudge" },
            ...(remindAt && !REMIND.includes(remindAt) ? [remindAt] : [])
              .concat(REMIND)
              .map((clock) => ({ value: clock, label: clockLabel(clock) })),
          ]}
        />
      </form>
      {habit ? (
        <div className="mt-7 border-t border-line pt-5">
          <HabitHistory habit={habit} />
        </div>
      ) : null}
    </Panel>
  );
}

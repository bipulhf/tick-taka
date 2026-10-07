import { parseTypedInteger } from "@tick-taka/shared/digits";
import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
import { PickerField } from "@/components/ui/picker-field";
import { clockLabel, clockOptions } from "@/components/ui/picker-options";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useOutbox } from "@/lib/outbox";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { type HabitWithProgress, useHabits } from "./queries";
import { useArchiveHabit } from "./use-archive-habit";

type Schedule = "daily" | "weekly" | "n_per_week";
const EMOJIS = ["💧", "🏃", "📖", "🧘", "🥗", "😴", "✍️", "🙏", "💪", "🎸"];
const REMIND = ["07:00", "09:00", "13:00", "18:00", "21:00"];
const perWeekLabel = (n: number | string) => `${n}× a week`;

function HabitForm({ habit }: { habit: HabitWithProgress | null }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const archive = useArchiveHabit();
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? "💧");
  // Habits are always grape on screen (purple means habits); the emoji gives each its identity.
  const color = habit?.color ?? "#A57BFF";
  const [schedule, setSchedule] = useState<Schedule>(habit?.schedule ?? "daily");
  const [perWeek, setPerWeek] = useState(habit?.perWeek ?? 3);
  const [target, setTarget] = useState(String(habit?.targetCount ?? 1));
  const [remindAt, setRemindAt] = useState<string | null>(habit?.remindAt ?? null);
  const targetCount = Math.max(1, Math.min(100, parseTypedInteger(target) || 1));

  const save = () => {
    const body = {
      name: name.trim(),
      emoji,
      color,
      schedule,
      perWeek: schedule === "n_per_week" ? perWeek : null,
      targetCount,
      remindAt,
    };
    if (habit)
      send({
        method: "PATCH",
        path: `/habits/${habit.id}`,
        body: { ...body, updatedAt: editTime() },
        label: "Couldn't save the habit",
      });
    else
      send({
        method: "POST",
        path: "/habits",
        body: { id: newId(), ...body },
        label: "Couldn't save the habit",
      });
    router.back();
  };

  return (
    <Sheet
      title={habit ? "Edit habit" : "New habit"}
      footer={
        <View className="flex-row gap-2">
          {habit ? (
            <>
              <Button
                label="Archive"
                variant="secondary"
                onPress={() => {
                  archive(habit);
                  router.back();
                }}
              />
              <DeleteButton
                onPress={() => {
                  remove(`/habits/${habit.id}`, `“${habit.name}”`);
                  router.back();
                }}
              />
            </>
          ) : null}
          <Button label="Save" onPress={save} disabled={!name.trim()} className="flex-1" />
        </View>
      }
    >
      <TextField
        value={name}
        onChangeText={setName}
        placeholder="Drink water"
        accessibilityLabel="Habit name"
        autoFocus={!habit}
      />
      <PickerField
        label="Emoji"
        layout="grid"
        value={emoji}
        options={EMOJIS.map((e) => ({ id: e, label: e }))}
        onChange={(e) => setEmoji(e ?? emoji)}
      />
      <Segmented<Schedule>
        label="Schedule"
        value={schedule}
        onChange={setSchedule}
        options={[
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "n_per_week", label: "N a week" },
        ]}
      />
      {schedule === "n_per_week" ? (
        <PickerField
          label="How often"
          value={String(perWeek)}
          options={[2, 3, 4, 5, 6].map((n) => ({ id: String(n), label: perWeekLabel(n) }))}
          // Tiki can set 1 or 7 (the schema allows 1-7): it reads "7× a week", not "7".
          describe={perWeekLabel}
          onChange={(n) => setPerWeek(Number(n ?? perWeek))}
        />
      ) : null}
      <TextField
        label="Count per day (e.g. 8 glasses)"
        value={target}
        onChangeText={setTarget}
        keyboardType="number-pad"
      />
      <PickerField
        label="Nudge me at"
        value={remindAt}
        noneLabel="No nudge"
        options={clockOptions(REMIND)}
        describe={clockLabel}
        onChange={setRemindAt}
      />
    </Sheet>
  );
}

export function HabitSheet({ id }: { id: string | null }) {
  const habits = useHabits();
  if (id && !habits.data)
    return (
      <Sheet title="Habit">
        {habits.isError ? <ErrorState onRetry={() => void habits.refetch()} /> : <SkeletonForm />}
      </Sheet>
    );
  return <HabitForm habit={id ? (habits.data?.find((h) => h.id === id) ?? null) : null} />;
}

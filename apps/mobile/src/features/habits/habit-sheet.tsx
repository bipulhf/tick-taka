import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useOutbox } from "@/lib/outbox";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { type HabitWithProgress, useHabits } from "./queries";
import { useArchiveHabit } from "./use-archive-habit";

type Schedule = "daily" | "weekly" | "n_per_week";
const COLORS = ["#A57BFF", "#5B8CFF", "#2EC4A0", "#FFB547", "#FF7A6B"];
const EMOJIS = ["💧", "🏃", "📖", "🧘", "🥗", "😴", "✍️", "🙏", "💪", "🎸"];
const REMIND = [null, "07:00", "09:00", "13:00", "18:00", "21:00"];

function HabitForm({ habit }: { habit: HabitWithProgress | null }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const archive = useArchiveHabit();
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState(habit?.emoji ?? "💧");
  const [color, setColor] = useState(habit?.color ?? "#A57BFF");
  const [schedule, setSchedule] = useState<Schedule>(habit?.schedule ?? "daily");
  const [perWeek, setPerWeek] = useState(habit?.perWeek ?? 3);
  const [target, setTarget] = useState(String(habit?.targetCount ?? 1));
  const [remindAt, setRemindAt] = useState<string | null>(habit?.remindAt ?? null);
  const targetCount = Math.max(1, Math.min(100, Number(target) || 1));

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
      <TextField value={name} onChangeText={setName} placeholder="Drink water" autoFocus={!habit} />
      <View className="flex-row flex-wrap gap-2">
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} tone="grape" selected={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </View>
      <View className="flex-row gap-3">
        {COLORS.map((c) => (
          <Text
            key={c}
            onPress={() => setColor(c)}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${c}`}
            className="h-10 w-10 rounded-full text-center leading-10"
            style={{ backgroundColor: c }}
          >
            {color === c ? "✓" : " "}
          </Text>
        ))}
      </View>
      <Segmented<Schedule>
        value={schedule}
        onChange={setSchedule}
        options={[
          { value: "daily", label: "Daily" },
          { value: "weekly", label: "Weekly" },
          { value: "n_per_week", label: "N a week" },
        ]}
      />
      {schedule === "n_per_week" ? (
        <View className="flex-row flex-wrap gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <Chip
              key={n}
              label={`${n}× a week`}
              tone="grape"
              selected={perWeek === n}
              onPress={() => setPerWeek(n)}
            />
          ))}
        </View>
      ) : null}
      <TextField
        label="Count per day (e.g. 8 glasses)"
        value={target}
        onChangeText={setTarget}
        keyboardType="number-pad"
      />
      <Text variant="label" tone="muted">
        Nudge me at
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {REMIND.map((time) => (
          <Chip
            key={time ?? "none"}
            label={time ?? "No nudge"}
            tone="grape"
            selected={remindAt === time}
            onPress={() => setRemindAt(time)}
          />
        ))}
      </View>
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

import { endOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { DeleteButton } from "@/components/ui/delete-button";
import { PickerField } from "@/components/ui/picker-field";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useAccounts, useSettings } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { userTime } from "@/lib/user-time";
import { useColors } from "@/theme/colors";
import { useGoals } from "./queries";

const EMOJIS = ["🫙", "💻", "🏍️", "✈️", "🏠", "🎓", "💍", "🕋", "🚑"];

export function GoalSheet({ id }: { id: string | null }) {
  const { data: goals } = useGoals();
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id && !goals?.some((g) => g.id === id))
    return (
      <Sheet title="Goal">
        <SkeletonForm fields={5} />
      </Sheet>
    );
  return <GoalForm id={id} />;
}

function GoalForm({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const colors = useColors();
  const { data: goals } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const { data: settings } = useSettings();
  const timeZone = userTime(settings).timeZone;
  const goal = id ? goals?.find((g) => g.id === id) : undefined;
  const [name, setName] = useState(goal?.name ?? "");
  const [emoji, setEmoji] = useState(goal?.emoji ?? "🫙");
  const [target, setTarget] = useState(goal ? String(toMajor(goal.targetMinor)) : "");
  const [deadline, setDeadline] = useState<string | null>(goal?.deadline ?? null);
  const [accountId, setAccountId] = useState<string | null>(goal?.accountId ?? null);
  const [createTasks, setCreateTasks] = useState(goal?.createTasks ?? true);
  const save = () => {
    const targetMinor = parseAmountToMinor(target);
    if (!targetMinor || !name.trim()) return;
    const body = { name: name.trim(), emoji, targetMinor, deadline, accountId, createTasks };
    if (goal)
      send({
        method: "PATCH",
        path: `/goals/${goal.id}`,
        body: { ...body, updatedAt: editTime() },
        label: "Couldn't save",
      });
    else
      send({
        method: "POST",
        path: "/goals",
        body: { id: newId(), ...body },
        label: "Couldn't save",
      });
    router.back();
  };
  return (
    <Sheet
      title={goal ? goal.name : "New savings goal"}
      footer={
        <View className="flex-row gap-2">
          {goal ? (
            <DeleteButton
              onPress={() => {
                remove(`/goals/${goal.id}`, `“${goal.name}”`);
                router.back();
              }}
            />
          ) : null}
          <Button
            label="Save"
            onPress={save}
            disabled={!name.trim() || !target}
            className="flex-1"
          />
        </View>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} placeholder="New laptop" />
      <PickerField
        label="Emoji"
        layout="grid"
        value={emoji}
        options={EMOJIS.map((e) => ({ id: e, label: e }))}
        onChange={(e) => setEmoji(e ?? emoji)}
      />
      <TextField
        label="Target"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        placeholder="120000"
      />
      <DateField
        label="Deadline"
        value={deadline ? formatLocalDate(deadline) : null}
        placeholder="No deadline"
        onPress={async () => {
          const picked = await pickDate(
            deadline ? endOfLocalDay(deadline, timeZone) - 1 : Date.now(),
            timeZone,
          );
          if (picked) setDeadline(picked > toLocalDate(Date.now(), timeZone) ? picked : deadline);
        }}
        onClear={() => setDeadline(null)}
        clearLabel="No deadline"
      />
      <PickerField
        label="Jar account (optional)"
        value={accountId}
        noneLabel="Virtual jar"
        options={accounts.map((a) => ({ id: a.id, label: a.name }))}
        onChange={setAccountId}
      />
      <View className="flex-row items-center justify-between">
        <Text className="flex-1">Add a monthly “move money to the jar” task</Text>
        <Switch
          value={createTasks}
          onValueChange={setCreateTasks}
          accessibilityLabel="Add a monthly move money to the jar task"
          trackColor={{ true: colors.mint, false: colors.lineStrong }}
        />
      </View>
    </Sheet>
  );
}

import { endOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useAccounts } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
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
  const colors = useColors();
  const { data: goals } = useGoals();
  const { data: accounts = [] } = useAccounts();
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
            <Button
              label="Delete"
              variant="secondary"
              onPress={() => {
                send({ method: "DELETE", path: `/goals/${goal.id}` });
                notify(`Deleted ${goal.name}`, {
                  label: "Undo",
                  onPress: () => send({ method: "POST", path: `/goals/${goal.id}/restore` }),
                });
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
      <View className="flex-row flex-wrap gap-2">
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} tone="mint" selected={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </View>
      <TextField
        label="Target"
        value={target}
        onChangeText={setTarget}
        keyboardType="decimal-pad"
        placeholder="120000"
      />
      <View className="flex-row gap-2">
        <Chip
          label={deadline ? `By ${formatLocalDate(deadline)}` : "Add a deadline"}
          tone="sky"
          selected={Boolean(deadline)}
          onPress={async () => {
            const picked = await pickDate(deadline ? endOfLocalDay(deadline) - 1 : Date.now());
            if (picked) setDeadline(picked > toLocalDate(Date.now()) ? picked : deadline);
          }}
        />
        {deadline ? <Chip label="No deadline" onPress={() => setDeadline(null)} /> : null}
      </View>
      <Text variant="label" tone="muted">
        Jar account (optional)
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Virtual jar" selected={!accountId} onPress={() => setAccountId(null)} />
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            tone="mint"
            selected={accountId === a.id}
            onPress={() => setAccountId(a.id)}
          />
        ))}
      </View>
      <View className="flex-row items-center justify-between">
        <Text className="flex-1">Add a monthly “move money to the jar” task</Text>
        <Switch
          value={createTasks}
          onValueChange={setCreateTasks}
          trackColor={{ true: colors.mint, false: colors.line }}
        />
      </View>
    </Sheet>
  );
}

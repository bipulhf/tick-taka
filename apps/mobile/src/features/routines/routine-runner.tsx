import { parseTypedInteger } from "@tick-taka/shared/digits";
import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { celebrate } from "@/components/ui/confetti";
import { DeleteButton } from "@/components/ui/delete-button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { Skeleton, SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useNow } from "@/features/timer/use-now";
import { formatTimer } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { editTime } from "@/lib/server-clock";
import { playSound } from "@/lib/sounds";
import { useRemove } from "@/lib/use-remove";
import { type Routine, useRoutines } from "./queries";

interface DraftStep {
  id?: string;
  title: string;
  minutes: number | null;
}

function StepTimer({ minutes }: { minutes: number }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const now = useNow(1000, startedAt !== null);
  const left =
    startedAt === null ? minutes * 60_000 : Math.max(0, startedAt + minutes * 60_000 - now);
  return (
    <Pressable
      onPress={() => setStartedAt(startedAt === null ? Date.now() : null)}
      className="min-h-12 flex-row items-center gap-1 rounded-full bg-sky/15 px-3"
      accessibilityRole="button"
      accessibilityLabel={startedAt ? "Reset step timer" : "Start step timer"}
    >
      <Icon name={startedAt ? "timer-sand" : "play"} size={16} color="sky" />
      <Text variant="caption" tone="sky" numeric>
        {formatTimer(left)}
      </Text>
    </Pressable>
  );
}

function Editor({ routine, onDone }: { routine: Routine; onDone: () => void }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const [name, setName] = useState(routine.name);
  const [emoji, setEmoji] = useState(routine.emoji);
  const [steps, setSteps] = useState<DraftStep[]>(
    routine.steps.map((s) => ({ id: s.id, title: s.title, minutes: s.minutes })),
  );
  const update = (index: number, patch: Partial<DraftStep>) =>
    setSteps((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const move = (index: number, by: number) =>
    setSteps((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      if (item === undefined) return list;
      next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item);
      return next;
    });
  return (
    <>
      <View className="flex-row gap-2">
        <TextField
          value={emoji}
          onChangeText={setEmoji}
          accessibilityLabel="Emoji"
          className="w-16"
        />
        <TextField
          value={name}
          onChangeText={setName}
          accessibilityLabel="Routine name"
          className="flex-1"
        />
      </View>
      {steps.map((step, index) => (
        <Card
          key={step.id ?? `new-${index.toString()}`}
          className="flex-row items-center gap-2 p-2"
        >
          <TextField
            value={step.title}
            onChangeText={(title) => update(index, { title })}
            accessibilityLabel={`Step ${index + 1}`}
            className="flex-1"
          />
          <TextField
            value={step.minutes ? String(step.minutes) : ""}
            onChangeText={(v) => update(index, { minutes: parseTypedInteger(v) || null })}
            placeholder="min"
            accessibilityLabel={`Minutes for step ${index + 1}`}
            keyboardType="number-pad"
            className="w-16"
          />
          <Pressable
            onPress={() => move(index, -1)}
            accessibilityRole="button"
            accessibilityLabel={`Move step ${index + 1} up`}
            className="h-12 w-12 items-center justify-center"
          >
            <Icon name="chevron-up" />
          </Pressable>
          <Pressable
            onPress={() => setSteps((list) => list.filter((_, i) => i !== index))}
            accessibilityRole="button"
            accessibilityLabel={`Remove step ${index + 1}`}
            className="h-12 w-12 items-center justify-center"
          >
            <Icon name="close" color="muted" />
          </Pressable>
        </Card>
      ))}
      <Button
        label="Add step"
        variant="secondary"
        icon="plus"
        onPress={() => setSteps([...steps, { title: "", minutes: null }])}
      />
      <Button
        label="Save routine"
        onPress={() => {
          send({
            method: "PATCH",
            path: `/routines/${routine.id}`,
            body: {
              name,
              emoji,
              steps: steps
                .filter((s) => s.title.trim())
                .map((s, sort) => ({
                  id: s.id ?? newId(),
                  title: s.title.trim(),
                  minutes: s.minutes,
                  sort,
                })),
              updatedAt: editTime(),
            },
            label: "Couldn't save the routine",
          });
          onDone();
        }}
      />
      <DeleteButton
        label="Delete routine"
        onPress={() => {
          remove(`/routines/${routine.id}`, `“${routine.name}”`);
          router.back();
        }}
      />
    </>
  );
}

/** Runs a routine as a checklist with optional per-step timers. */
export function RoutineRunner({ id, startInEdit }: { id: string; startInEdit: boolean }) {
  const routines = useRoutines();
  const routine = routines.data?.find((r) => r.id === id);
  const [editing, setEditing] = useState(startInEdit);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const total = routine?.steps.length ?? 0;
  const allDone = total > 0 && checked.size === total;
  useEffect(() => {
    if (allDone) celebrate();
  }, [allDone]);
  if (!routine)
    return (
      <Screen title="Routine" tabBarPadding={false}>
        {routines.isError ? (
          <ErrorState onRetry={() => void routines.refetch()} />
        ) : (
          <>
            <Skeleton className="h-2.5 w-full" />
            <SkeletonList rows={4} />
          </>
        )}
      </Screen>
    );
  return (
    <Screen
      title={`${routine.emoji} ${routine.name}`}
      tabBarPadding={false}
      right={
        <Button
          label={editing ? "Cancel" : "Edit"}
          size="sm"
          variant="secondary"
          onPress={() => setEditing(!editing)}
        />
      }
    >
      {editing ? (
        <Editor routine={routine} onDone={() => setEditing(false)} />
      ) : (
        <>
          <ProgressBar value={total ? checked.size / total : 0} tone="grape" />
          {total === 0 ? (
            <EmptyState
              title="No steps yet"
              message="Add a few small steps and this routine runs itself."
              actionLabel="Add steps"
              onAction={() => setEditing(true)}
            />
          ) : null}
          {routine.steps.map((step) => (
            <Card key={step.id} className="flex-row items-center gap-2 py-1 pl-1">
              <Checkbox
                tone="grape"
                checked={checked.has(step.id)}
                label={step.title}
                onChange={(on) => {
                  if (on) playSound("pop");
                  setChecked((set) => {
                    const next = new Set(set);
                    if (on) next.add(step.id);
                    else next.delete(step.id);
                    return next;
                  });
                }}
              />
              <Text className={`flex-1 ${checked.has(step.id) ? "text-muted line-through" : ""}`}>
                {step.title}
              </Text>
              {step.minutes ? <StepTimer minutes={step.minutes} /> : null}
            </Card>
          ))}
          {allDone ? (
            <Text variant="heading" className="text-center">
              All done. Nicely closed. ✨
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}

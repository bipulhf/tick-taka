import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { type TaskRow, useAiStatus } from "@/lib/queries";
import type { Form } from "./task-form";
import { useTaskActions } from "./use-task-actions";

/** A saved task's subtasks: tick, add, break it down with AI, or start a focus session. */
export function TaskSubtasks({
  id,
  task,
  form,
}: {
  id: string;
  task: { subtasks: TaskRow[] };
  form: Form;
}) {
  const router = useRouter();
  const send = useOutbox();
  const actions = useTaskActions();
  const ai = useAiStatus();
  const [newSubtask, setNewSubtask] = useState("");
  const [breaking, setBreaking] = useState(false);

  const nextSort = useRef(0);
  const addSubtask = (title: string) => {
    if (!id || !title.trim()) return;
    // New subtasks go to the end of the list.
    nextSort.current = Math.max(nextSort.current, task?.subtasks.length ?? 0) + 1;
    send({
      method: "POST",
      path: "/tasks",
      body: {
        id: newId(),
        title: title.trim(),
        parentId: id,
        status: "open",
        sort: nextSort.current,
      },
      label: "Couldn't add the subtask",
    });
  };

  const breakDown = async () => {
    setBreaking(true);
    try {
      const result = await unwrap(
        api.ai.breakdown.$post({ json: { title: form.title, notes: form.notes || undefined } }),
      );
      for (const title of result.subtasks) addSubtask(title);
      notify(`Added ${result.subtasks.length} subtasks`);
    } catch (error) {
      notify(friendlyError(error));
    } finally {
      setBreaking(false);
    }
  };

  return (
    <>
      <Text variant="label" tone="muted">
        Subtasks
      </Text>
      {task.subtasks.map((sub) => (
        <View key={sub.id} className="flex-row items-center">
          <Checkbox
            checked={sub.status === "done"}
            onChange={() => actions.toggleDone(sub)}
            label={sub.title}
          />
          <Text className={`flex-1 ${sub.status === "done" ? "text-muted line-through" : ""}`}>
            {sub.title}
          </Text>
        </View>
      ))}
      <TextField
        value={newSubtask}
        onChangeText={setNewSubtask}
        placeholder="Add a subtask"
        returnKeyType="done"
        onSubmitEditing={() => {
          addSubtask(newSubtask);
          setNewSubtask("");
        }}
      />
      <View className="flex-row gap-2">
        {ai.data?.configured && ai.data.features.breakdown ? (
          <Button
            label="Break it down"
            icon="auto-fix"
            variant="secondary"
            size="sm"
            loading={breaking}
            onPress={breakDown}
            className="flex-1"
          />
        ) : null}
        <Button
          label="Focus"
          icon="sprout"
          variant="time"
          size="sm"
          onPress={() => router.replace(`/focus?taskId=${id}`)}
          className="flex-1"
        />
      </View>
    </>
  );
}

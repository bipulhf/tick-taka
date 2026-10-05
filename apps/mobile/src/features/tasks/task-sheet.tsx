import { useQuery } from "@tanstack/react-query";
import { endOfLocalDay, MINUTE_MS, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { describeRRule, parseRecurrence } from "@tick-taka/shared/recurrence";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { formatMinutes, formatWhen } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { pickDate, pickTime } from "@/lib/pick-date";
import { useAiStatus, useAreas, useSettings } from "@/lib/queries";
import { useTaskActions } from "./use-task-actions";

type Priority = "low" | "normal" | "high";
const ESTIMATES = [15, 30, 60, 90, 120, 180];

interface Form {
  title: string;
  notes: string;
  areaId: string | null;
  projectId: string | null;
  doAt: number | null;
  hasTime: boolean;
  whenSlot: "day" | "evening";
  status: "inbox" | "open" | "someday" | "done";
  deadlineAt: number | null;
  priority: Priority;
  energy: "high" | "low" | null;
  estimateMin: number | null;
  urgent: boolean;
  rrule: string | null;
  top3Date: string | null;
}

const EMPTY: Form = {
  title: "",
  notes: "",
  areaId: null,
  projectId: null,
  doAt: null,
  hasTime: false,
  whenSlot: "day",
  status: "inbox",
  deadlineAt: null,
  priority: "normal",
  energy: null,
  estimateMin: null,
  urgent: false,
  rrule: null,
  top3Date: null,
};

/** Create or edit a task in a bottom sheet. */
export function TaskSheet({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const actions = useTaskActions();
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const ai = useAiStatus();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const today = toLocalDate(Date.now(), timeZone);
  const query = useQuery({
    queryKey: ["task", id],
    queryFn: () => unwrap(api.tasks[":id"].$get({ param: { id: id! } })),
    enabled: Boolean(id),
  });
  const [form, setForm] = useState<Form>(EMPTY);
  const [repeatText, setRepeatText] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [breaking, setBreaking] = useState(false);
  const task = query.data;

  // Fill the form once per task; later refetches (after a subtask is added) must not
  // overwrite edits that haven't been saved yet.
  const loadedId = useRef<string | null>(null);
  useEffect(() => {
    if (!task || loadedId.current === task.id) return;
    loadedId.current = task.id;
    setForm({
      title: task.title,
      notes: task.notes ?? "",
      areaId: task.areaId,
      projectId: task.projectId,
      doAt: task.doAt,
      hasTime: task.hasTime,
      whenSlot: task.whenSlot,
      status: task.status,
      deadlineAt: task.deadlineAt,
      priority: task.priority,
      energy: task.energy,
      estimateMin: task.estimateMin,
      urgent: task.urgent,
      rrule: task.rrule,
      top3Date: task.top3Date,
    });
  }, [task]);

  const projects = useQuery({
    queryKey: ["projects", form.areaId],
    queryFn: () => unwrap(api.projects.$get({ query: { areaId: form.areaId!, status: "active" } })),
    enabled: Boolean(form.areaId),
  });

  const parsedRepeat = useMemo(
    () => (repeatText.trim() ? parseRecurrence(`x ${repeatText}`) : null),
    [repeatText],
  );
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const setDay = async (choice: "today" | "tomorrow" | "pick" | "none") => {
    if (choice === "none")
      return setForm((f) => ({
        ...f,
        doAt: null,
        hasTime: false,
        status: f.status === "open" ? "inbox" : f.status,
      }));
    let date = today;
    if (choice === "tomorrow") date = toLocalDate(Date.now() + 86_400_000, timeZone);
    if (choice === "pick") {
      const picked = await pickDate(form.doAt ?? Date.now(), timeZone);
      if (!picked) return;
      date = picked;
    }
    setForm((f) => ({
      ...f,
      doAt: startOfLocalDay(date, timeZone),
      hasTime: false,
      status: f.status === "inbox" || f.status === "someday" ? "open" : f.status,
    }));
  };

  const setTime = async () => {
    const date = form.doAt ? toLocalDate(form.doAt, timeZone) : today;
    const at = await pickTime(date, form.doAt ?? Date.now(), timeZone);
    if (at)
      setForm((f) => ({
        ...f,
        doAt: at,
        hasTime: true,
        status: f.status === "done" ? "done" : "open",
      }));
  };

  const setDeadline = async () => {
    const picked = await pickDate(form.deadlineAt ?? Date.now(), timeZone);
    if (picked) set("deadlineAt", endOfLocalDay(picked, timeZone) - MINUTE_MS);
  };

  const save = () => {
    if (!form.title.trim()) return;
    const rrule = parsedRepeat?.rrule ?? form.rrule;
    const body = {
      ...form,
      title: form.title.trim(),
      notes: form.notes.trim() || null,
      rrule,
      reminderAt: form.hasTime ? form.doAt : null,
    };
    if (id)
      send({
        method: "PATCH",
        path: `/tasks/${id}`,
        body: { ...body, updatedAt: Date.now() },
        label: "Couldn't save the task",
      });
    else
      send({
        method: "POST",
        path: "/tasks",
        body: { id: newId(), ...body },
        label: "Couldn't save the task",
      });
    router.back();
  };

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
      notify((error as Error).message);
    } finally {
      setBreaking(false);
    }
  };

  const doDate = form.doAt ? toLocalDate(form.doAt, timeZone) : null;
  const advanced = settings?.advancedViews;

  // Editing: hold the form back until the task has filled it (any edit replaces EMPTY).
  if (id && form === EMPTY)
    return (
      <Sheet title="Task">
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <SkeletonForm fields={5} />
        )}
      </Sheet>
    );

  return (
    <Sheet
      title={id ? "Task" : "New task"}
      footer={
        <View className="flex-row gap-2">
          {id && task ? (
            <Button
              label="Delete"
              variant="secondary"
              icon="trash-can-outline"
              onPress={() => {
                actions.remove(task);
                router.back();
              }}
            />
          ) : null}
          <Button label="Done" onPress={save} disabled={!form.title.trim()} className="flex-1" />
        </View>
      }
    >
      <TextField
        value={form.title}
        onChangeText={(v) => set("title", v)}
        placeholder="What needs doing?"
        autoFocus={!id}
      />
      <TextField
        value={form.notes}
        onChangeText={(v) => set("notes", v)}
        placeholder="Notes"
        multiline
      />

      <Text variant="label" tone="muted">
        Do it
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label="Today"
          tone="sky"
          selected={doDate === today}
          onPress={() => setDay("today")}
        />
        <Chip
          label="Tomorrow"
          tone="sky"
          selected={doDate === toLocalDate(Date.now() + 86_400_000, timeZone)}
          onPress={() => setDay("tomorrow")}
        />
        <Chip
          label={form.doAt && doDate !== today ? formatWhen(form.doAt, false) : "Pick date"}
          tone="sky"
          selected={Boolean(form.doAt) && doDate !== today}
          onPress={() => setDay("pick")}
        />
        <Chip
          label={
            form.hasTime && form.doAt
              ? (formatWhen(form.doAt, true).split(", ")[1] ?? "Time")
              : "Add time"
          }
          tone="sky"
          selected={form.hasTime}
          onPress={setTime}
        />
        <Chip
          label="Evening"
          tone="sky"
          selected={form.whenSlot === "evening"}
          onPress={() => set("whenSlot", form.whenSlot === "evening" ? "day" : "evening")}
        />
        <Chip
          label="Someday"
          tone="sky"
          selected={form.status === "someday"}
          onPress={() =>
            setForm((f) => ({
              ...f,
              status: f.status === "someday" ? "inbox" : "someday",
              doAt: null,
              hasTime: false,
            }))
          }
        />
        <Chip
          label="No date"
          selected={!form.doAt && form.status !== "someday"}
          onPress={() => setDay("none")}
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={
            form.deadlineAt ? `Deadline ${formatWhen(form.deadlineAt, false)}` : "Add deadline"
          }
          tone="coral"
          selected={Boolean(form.deadlineAt)}
          onPress={setDeadline}
        />
        {form.deadlineAt ? (
          <Chip label="Clear deadline" onPress={() => set("deadlineAt", null)} />
        ) : null}
        <Chip
          label={form.top3Date === today ? "In top three" : "Add to top three"}
          tone="mango"
          selected={form.top3Date === today}
          onPress={() => set("top3Date", form.top3Date === today ? null : today)}
        />
      </View>

      <TextField
        label="Repeat"
        value={repeatText}
        onChangeText={setRepeatText}
        placeholder={form.rrule ? describeRRule(form.rrule) : "e.g. every other Tuesday"}
        error={repeatText && !parsedRepeat ? "Try “every month on the 5th”" : undefined}
      />
      {parsedRepeat ? (
        <Text variant="caption" tone="sky">
          ↻ {describeRRule(parsedRepeat.rrule)}
        </Text>
      ) : null}
      {form.rrule && !repeatText ? (
        <Chip label="Stop repeating" onPress={() => set("rrule", null)} />
      ) : null}

      <Text variant="label" tone="muted">
        Priority
      </Text>
      <Segmented<Priority>
        value={form.priority}
        onChange={(v) => set("priority", v)}
        options={[
          { value: "low", label: "Low" },
          { value: "normal", label: "Normal" },
          { value: "high", label: "High" },
        ]}
      />
      {advanced?.eisenhower ? (
        <Chip
          label={form.urgent ? "Urgent" : "Not urgent"}
          tone="coral"
          selected={form.urgent}
          onPress={() => set("urgent", !form.urgent)}
        />
      ) : null}
      {advanced?.energy ? (
        <View className="flex-row gap-2">
          <Chip
            label="⚡ High energy"
            tone="grape"
            selected={form.energy === "high"}
            onPress={() => set("energy", form.energy === "high" ? null : "high")}
          />
          <Chip
            label="🌙 Low energy"
            tone="grape"
            selected={form.energy === "low"}
            onPress={() => set("energy", form.energy === "low" ? null : "low")}
          />
        </View>
      ) : null}

      <Text variant="label" tone="muted">
        Estimate
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {ESTIMATES.map((minutes) => (
          <Chip
            key={minutes}
            label={formatMinutes(minutes)}
            tone="sky"
            selected={form.estimateMin === minutes}
            onPress={() => set("estimateMin", form.estimateMin === minutes ? null : minutes)}
          />
        ))}
      </View>

      <Text variant="label" tone="muted">
        Area
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {areas.map((area) => (
          <Chip
            key={area.id}
            label={`${area.emoji} ${area.name}`}
            tone="sky"
            selected={form.areaId === area.id}
            onPress={() =>
              setForm((f) => ({
                ...f,
                areaId: f.areaId === area.id ? null : area.id,
                projectId: null,
              }))
            }
          />
        ))}
      </View>
      {projects.data?.length ? (
        <View className="flex-row flex-wrap gap-2">
          {projects.data.map((project) => (
            <Chip
              key={project.id}
              label={project.name}
              tone="grape"
              selected={form.projectId === project.id}
              onPress={() => set("projectId", form.projectId === project.id ? null : project.id)}
            />
          ))}
        </View>
      ) : null}

      {id && task ? (
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
      ) : null}
      {id ? (
        <Pressable onPress={() => router.replace(`/plan/logbook`)} className="items-center py-2">
          <Text variant="caption" tone="muted">
            Finished tasks live in the Logbook
          </Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

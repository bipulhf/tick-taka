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
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PickerField } from "@/components/ui/picker-field";
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
import { editTime } from "@/lib/server-clock";
import { userTime } from "@/lib/user-time";
import { useTaskActions } from "./use-task-actions";

type Priority = "low" | "normal" | "high";
type WhenChoice = "today" | "evening" | "tomorrow" | "pick" | "someday" | "none";
const ESTIMATES = [15, 30, 60, 90, 120, 180];

/** "More options" stays open or closed the way it was last left. */
let moreOpenLastTime = false;

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
  const timeZone = userTime(settings).timeZone;
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

  const setWhen = async (choice: WhenChoice) => {
    if (choice === "none")
      return setForm((f) => ({
        ...f,
        doAt: null,
        hasTime: false,
        whenSlot: "day",
        status: f.status === "open" || f.status === "someday" ? "inbox" : f.status,
      }));
    if (choice === "someday")
      return setForm((f) => ({ ...f, status: "someday", doAt: null, hasTime: false }));
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
      whenSlot: choice === "evening" ? "evening" : "day",
      status: f.status === "inbox" || f.status === "someday" ? "open" : f.status,
    }));
  };

  const [moreOpen, setMoreOpen] = useState(moreOpenLastTime);
  const toggleMore = (open: boolean) => {
    moreOpenLastTime = open;
    setMoreOpen(open);
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
        body: { ...body, updatedAt: editTime() },
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
  const whenValue: WhenChoice | null =
    form.status === "someday"
      ? "someday"
      : !form.doAt
        ? null
        : doDate === today
          ? form.whenSlot === "evening"
            ? "evening"
            : "today"
          : doDate === toLocalDate(Date.now() + 86_400_000, timeZone)
            ? "tomorrow"
            : "pick";
  // What's set behind "More", so a closed disclosure still says so.
  const moreSummary = [
    form.deadlineAt ? `Deadline ${formatWhen(form.deadlineAt, false)}` : null,
    form.top3Date === today ? "Top three" : null,
    form.rrule || parsedRepeat ? "Repeats" : null,
    form.priority !== "normal" ? `${form.priority === "high" ? "High" : "Low"} priority` : null,
    areas.find((a) => a.id === form.areaId)?.name ?? null,
  ]
    .filter(Boolean)
    .join(" · ");

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
            <DeleteButton
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
        accessibilityLabel="Title"
        autoFocus={!id}
      />
      <TextField
        value={form.notes}
        onChangeText={(v) => set("notes", v)}
        placeholder="Notes"
        multiline
      />

      <View className="flex-row gap-3">
        <PickerField
          label="When"
          span="half"
          value={whenValue}
          noneLabel="No date"
          options={[
            { id: "today", label: "Today" },
            { id: "evening", label: "This evening" },
            { id: "tomorrow", label: "Tomorrow" },
            {
              id: "pick",
              label:
                whenValue === "pick" && form.doAt
                  ? `${formatWhen(form.doAt, false)}${form.whenSlot === "evening" ? " · evening" : ""}`
                  : "Pick a date…",
            },
            { id: "someday", label: "Someday" },
          ]}
          onChange={(choice) => void setWhen((choice ?? "none") as WhenChoice)}
        />
        <PickerField
          label="Estimate"
          span="half"
          value={form.estimateMin === null ? null : String(form.estimateMin)}
          noneLabel="No estimate"
          options={ESTIMATES.map((minutes) => ({
            id: String(minutes),
            label: formatMinutes(minutes),
          }))}
          onChange={(minutes) => set("estimateMin", minutes === null ? null : Number(minutes))}
        />
      </View>
      {form.doAt ? (
        <Button
          label={
            form.hasTime
              ? `At ${formatWhen(form.doAt, true).split(", ")[1] ?? "a set time"}`
              : "Add a time"
          }
          icon="clock-outline"
          variant="secondary"
          size="sm"
          onPress={setTime}
          className="self-start"
        />
      ) : null}

      <Pressable
        onPress={() => toggleMore(!moreOpen)}
        accessibilityRole="button"
        accessibilityState={{ expanded: moreOpen }}
        className="min-h-12 flex-row items-center gap-2 px-1"
      >
        <Icon name="tune-variant" size={20} color="muted" />
        <Text variant="callout" tone="muted" numberOfLines={1} className="flex-1">
          {moreOpen ? "Fewer options" : moreSummary || "More options"}
        </Text>
        <Icon name={moreOpen ? "chevron-up" : "chevron-down"} size={20} color="muted" />
      </Pressable>

      {moreOpen ? (
        <>
          <PickerField
            label="Deadline"
            value={form.deadlineAt ? "pick" : null}
            noneLabel="No deadline"
            options={[
              {
                id: "pick",
                label: form.deadlineAt ? formatWhen(form.deadlineAt, false) : "Pick a date…",
              },
            ]}
            onChange={(choice) => (choice === null ? set("deadlineAt", null) : void setDeadline())}
          />
          <Chip
            label={form.top3Date === today ? "In top three" : "Add to top three"}
            tone="mango"
            selected={form.top3Date === today}
            onPress={() => set("top3Date", form.top3Date === today ? null : today)}
            className="self-start"
          />

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
              className="self-start"
            />
          ) : null}
          {advanced?.energy ? (
            <PickerField
              label="Energy"
              value={form.energy}
              noneLabel="Any energy"
              options={[
                { id: "high", label: "High energy", emoji: "⚡" },
                { id: "low", label: "Low energy", emoji: "🌙" },
              ]}
              onChange={(energy) => set("energy", energy as Form["energy"])}
            />
          ) : null}

          <View className="flex-row gap-3">
            <PickerField
              label="Area"
              span="half"
              value={form.areaId}
              noneLabel="No area"
              options={areas.map((area) => ({ id: area.id, label: area.name, emoji: area.emoji }))}
              onChange={(areaId) => setForm((f) => ({ ...f, areaId, projectId: null }))}
            />
            {projects.data?.length ? (
              <PickerField
                label="Project"
                span="half"
                value={form.projectId}
                noneLabel="No project"
                options={projects.data.map((project) => ({ id: project.id, label: project.name }))}
                onChange={(projectId) => set("projectId", projectId)}
              />
            ) : null}
          </View>
        </>
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
        <Pressable
          onPress={() => router.replace(`/plan/logbook`)}
          accessibilityRole="link"
          className="min-h-12 items-center justify-center"
        >
          <Text variant="caption" tone="muted">
            Finished tasks live in the Logbook
          </Text>
        </Pressable>
      ) : null}
    </Sheet>
  );
}

import { useQuery } from "@tanstack/react-query";
import { endOfLocalDay, MINUTE_MS, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { defined } from "@tick-taka/shared/defined";
import { newId } from "@tick-taka/shared/ids";
import { parseRecurrence } from "@tick-taka/shared/recurrence";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { PickerField } from "@/components/ui/picker-field";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { formatMinutes, formatWhen } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickDate, pickTime } from "@/lib/pick-date";
import { useAiStatus, useAreas, useSettings } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { userTime } from "@/lib/user-time";
import { EMPTY, ESTIMATES, type Form, type WhenChoice } from "./task-form";
import { TaskMoreFields } from "./task-more-fields";
import { TaskSubtasks } from "./task-subtasks";
import { useTaskActions } from "./use-task-actions";

/** "More options" stays open or closed the way it was last left. */
let moreOpenLastTime = false;

/** Create or edit a task in a bottom sheet. */
export function TaskSheet({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const actions = useTaskActions();
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const _ai = useAiStatus();
  const timeZone = userTime(settings).timeZone;
  const today = toLocalDate(Date.now(), timeZone);
  const query = useQuery({
    queryKey: ["task", id],
    queryFn: () => unwrap(api.tasks[":id"].$get({ param: { id: defined(id, "the task id") } })),
    enabled: Boolean(id),
  });
  const [form, setForm] = useState<Form>(EMPTY);
  const [repeatText, setRepeatText] = useState("");
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
    queryFn: () =>
      unwrap(
        api.projects.$get({
          query: { areaId: defined(form.areaId, "the area"), status: "active" },
        }),
      ),
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
    form.deadlineAt ? `Deadline ${formatWhen(form.deadlineAt, false, Date.now(), timeZone)}` : null,
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
                  ? `${formatWhen(form.doAt, false, Date.now(), timeZone)}${form.whenSlot === "evening" ? " · evening" : ""}`
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
              ? `At ${formatWhen(form.doAt, true, Date.now(), timeZone).split(", ")[1] ?? "a set time"}`
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
        <TaskMoreFields
          form={form}
          set={set}
          setForm={setForm}
          today={today}
          repeatText={repeatText}
          setRepeatText={setRepeatText}
          parsedRepeat={parsedRepeat}
          advanced={advanced}
          areas={areas}
          projects={projects}
          setDeadline={setDeadline}
        />
      ) : null}
      {id && task ? <TaskSubtasks id={id} task={task} form={form} /> : null}
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

import { Link } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { parseRecurrence } from "@tick-taka/shared/recurrence";
import { Check, ChevronDown, ChevronUp, RotateCcw, SlidersHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextArea, TextField } from "@/components/ui/text-field";
import { formatWhen } from "@/lib/format";
import { useAreas, useSettings } from "@/lib/queries";
import { useTodayDate } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { type TaskDetail, useProjects, useTask } from "./queries";
import { type Form, formFromPreset, taskBody } from "./task-form";
import { TaskMoreFields } from "./task-more-fields";
import { TaskSubtasks } from "./task-subtasks";
import { TaskWhenFields } from "./task-when-fields";
import { useTaskActions } from "./use-task-actions";

/** "More options" stays open or closed the way it was last left. */
let moreOpenLastTime = false;

const FORM_ID = "task-panel-form";

function formOf(task: TaskDetail): Form {
  return {
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
    estimateMin: task.estimateMin,
    rrule: task.rrule,
    top3Date: task.top3Date,
  };
}

/** `?panel=task:<id>` edits a task; `task:new` creates one, filled from `?preset=`. */
export function TaskPanel({ id, onClose, preset }: PanelComponentProps) {
  const isNew = id === "new";
  const query = useTask(isNew ? null : id);
  // Editing: hold the form back until the task has loaded, so it starts from it.
  if (!isNew && !query.data)
    return (
      <Panel open onClose={onClose} title="Task">
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : (
          <div role="status" aria-label="Loading">
            <SkeletonRows rows={5} />
          </div>
        )}
      </Panel>
    );
  return <TaskForm task={query.data ?? null} preset={preset} onClose={onClose} />;
}

function TaskForm({
  task,
  preset,
  onClose,
}: {
  task: TaskDetail | null;
  preset: URLSearchParams;
  onClose: () => void;
}) {
  const actions = useTaskActions();
  const { data: settings } = useSettings();
  const { data: areas = [] } = useAreas();
  const timeZone = userTime(settings).timeZone;
  const today = useTodayDate();
  // Filled once: a refetch (after a subtask is added) never overwrites unsaved edits.
  const [initial] = useState<Form>(() => (task ? formOf(task) : formFromPreset(preset, timeZone)));
  const [form, setFormState] = useState<Form>(initial);
  const [repeatText, setRepeatText] = useState("");
  const [moreOpen, setMoreOpen] = useState(moreOpenLastTime);
  const [saving, setSaving] = useState(false);
  const projects = useProjects(form.areaId);

  const setForm = (update: (form: Form) => Form) => setFormState(update);
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setFormState((f) => ({ ...f, [key]: value }));
  const toggleMore = (open: boolean) => {
    moreOpenLastTime = open;
    setMoreOpen(open);
  };

  const parsedRepeat = useMemo(
    () => (repeatText.trim() ? parseRecurrence(`x ${repeatText}`) : null),
    [repeatText],
  );
  const dirty = JSON.stringify(form) !== JSON.stringify(initial) || repeatText.trim() !== "";

  const save = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    const body = taskBody(form, parsedRepeat?.rrule ?? null);
    try {
      if (task)
        await write({
          method: "PATCH",
          path: `/tasks/${task.id}`,
          body,
          label: "Couldn't save the task",
        });
      else
        await write({
          method: "POST",
          path: "/tasks",
          body: { id: newId(), ...body },
          label: "Couldn't save the task",
        });
      onClose();
    } catch {
      // The toast says why; what was typed stays.
      setSaving(false);
    }
  };

  // Complete and Reopen are ticking the row: the same write, sound and Undo toast, and
  // a repeating task makes its next copy. Edits typed first are saved before it.
  const toggleDone = async () => {
    if (!task || saving) return;
    if (dirty && form.title.trim()) {
      setSaving(true);
      try {
        await write({
          method: "PATCH",
          path: `/tasks/${task.id}`,
          body: taskBody(form, parsedRepeat?.rrule ?? null),
          label: "Couldn't save the task",
        });
      } catch {
        // The toast says why; what was typed stays.
        setSaving(false);
        return;
      }
    }
    actions.toggleDone({ ...task, title: form.title.trim() || task.title });
    onClose();
  };

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

  return (
    <Panel
      open
      onClose={onClose}
      title={task ? "Task" : "New task"}
      dirty={dirty && !saving}
      footer={
        <>
          {task ? (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                actions.remove(task);
                onClose();
              }}
            >
              Delete
            </Button>
          ) : null}
          {task ? (
            <Button
              icon={task.status === "done" ? RotateCcw : Check}
              onClick={() => void toggleDone()}
              disabled={saving}
            >
              {task.status === "done" ? "Reopen" : "Complete"}
            </Button>
          ) : null}
          <Button
            type="submit"
            form={FORM_ID}
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!form.title.trim()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          aria-label="Title"
          value={form.title}
          onChange={(event) => set("title", event.target.value)}
          placeholder="What needs doing?"
          autoFocus={!task}
          className="[&_input]:h-11 [&_input]:text-heading [&_input]:font-semibold"
        />
        <TextArea
          aria-label="Notes"
          value={form.notes}
          onChange={(event) => set("notes", event.target.value)}
          placeholder="Notes"
          rows={3}
        />
        <TaskWhenFields form={form} setForm={setForm} today={today} timeZone={timeZone} />

        <button
          type="button"
          onClick={() => toggleMore(!moreOpen)}
          aria-expanded={moreOpen}
          className="-mx-1 flex min-h-10 items-center gap-2 rounded-xl px-1 text-left text-callout text-muted hover:text-ink"
        >
          <SlidersHorizontal aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate font-semibold">
            {moreOpen ? "Fewer options" : moreSummary || "More options"}
          </span>
          {moreOpen ? (
            <ChevronUp aria-hidden className="size-4" />
          ) : (
            <ChevronDown aria-hidden className="size-4" />
          )}
        </button>

        {moreOpen ? (
          <TaskMoreFields
            form={form}
            set={set}
            setForm={setForm}
            today={today}
            timeZone={timeZone}
            repeatText={repeatText}
            setRepeatText={setRepeatText}
            parsedRepeat={parsedRepeat}
            areas={areas}
            projects={projects.data}
          />
        ) : null}
      </form>

      {task ? (
        <div className="mt-6 flex flex-col gap-4">
          <TaskSubtasks
            id={task.id}
            subtasks={task.subtasks}
            title={form.title}
            notes={form.notes}
          />
          <Link
            to="/plan/logbook"
            className="self-center rounded-lg px-2 py-1 text-caption text-muted hover:text-ink"
          >
            Finished tasks live in the Logbook
          </Link>
        </div>
      ) : null}
    </Panel>
  );
}

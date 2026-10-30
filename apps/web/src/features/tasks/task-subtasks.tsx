import { useNavigate } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { Sparkles, Sprout } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cx } from "@/components/ui/cx";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { type TaskRow, useAiStatus } from "@/lib/queries";
import { notify, notifyError } from "@/lib/toast";
import { fire } from "@/lib/write";
import { useTaskActions } from "./use-task-actions";

/** A saved task's subtasks: tick, add, break it down with AI, or start a focus session. */
export function TaskSubtasks({
  id,
  subtasks,
  title,
  notes,
}: {
  id: string;
  subtasks: TaskRow[];
  /** What's typed in the panel now, for "Break it down". */
  title: string;
  notes: string;
}) {
  const navigate = useNavigate();
  const actions = useTaskActions();
  const ai = useAiStatus();
  const [newSubtask, setNewSubtask] = useState("");
  const [breaking, setBreaking] = useState(false);

  const nextSort = useRef(0);
  const addSubtask = (text: string) => {
    if (!text.trim()) return;
    // New subtasks go to the end of the list.
    nextSort.current = Math.max(nextSort.current, subtasks.length) + 1;
    fire({
      method: "POST",
      path: "/tasks",
      body: {
        id: newId(),
        title: text.trim(),
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
        api.ai.breakdown.$post({ json: { title, notes: notes || undefined } }),
      );
      for (const subtask of result.subtasks) addSubtask(subtask);
      notify(`Added ${result.subtasks.length} subtasks`);
    } catch (error) {
      notifyError(friendlyError(error));
    } finally {
      setBreaking(false);
    }
  };

  const canBreakDown = Boolean(
    ai.data?.configured && ai.data.features.breakdown && !ai.data.capReached,
  );

  return (
    <section aria-labelledby="subtasks-title" className="flex flex-col gap-2">
      <h3 id="subtasks-title" className="text-caption text-muted">
        Subtasks
      </h3>
      {subtasks.length ? (
        <ul className="flex flex-col">
          {subtasks.map((sub) => (
            <li key={sub.id} className="flex min-h-9 items-center gap-3">
              <Checkbox
                size="sm"
                checked={sub.status === "done"}
                onChange={() => actions.toggleDone({ ...sub, parentId: id })}
                label={
                  sub.status === "done" ? `Mark “${sub.title}” not done` : `Complete “${sub.title}”`
                }
              />
              <span
                className={cx(
                  "flex-1 text-body",
                  sub.status === "done" && "text-muted line-through decoration-line-strong",
                )}
              >
                {sub.title}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <TextField
        aria-label="Add a subtask"
        value={newSubtask}
        onChange={(event) => setNewSubtask(event.target.value)}
        placeholder="Add a subtask"
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          addSubtask(newSubtask);
          setNewSubtask("");
        }}
      />
      <div className="flex gap-2">
        {canBreakDown ? (
          <Button
            icon={Sparkles}
            size="sm"
            loading={breaking}
            onClick={breakDown}
            className="flex-1"
          >
            Break it down
          </Button>
        ) : null}
        <Button
          icon={Sprout}
          variant="time"
          size="sm"
          onClick={() => void navigate({ to: "/focus", search: { taskId: id } as never })}
          className="flex-1"
        >
          Focus
        </Button>
      </div>
    </section>
  );
}

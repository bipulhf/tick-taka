import { useNavigate } from "@tanstack/react-router";
import { Command } from "cmdk";
import {
  BarChart3,
  CircleCheckBig,
  CircleMinus,
  CirclePlus,
  Sprout,
  Star,
  Timer,
} from "lucide-react";
import { useEffect } from "react";
import {
  paletteItemClass,
  registerPaletteActions,
  registerPaletteSearch,
} from "@/components/shell/command-palette";
import { useTaskSearch } from "@/features/tasks/queries";
import { formatWhen } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useTodayDate, useUserTime } from "@/lib/use-today";

const icon = "size-4 text-muted";

function TaskResults({
  query,
  close,
  openTask,
}: {
  query: string;
  close: () => void;
  openTask: (id: string) => void;
}) {
  const search = useTaskSearch(query);
  const { timeZone } = useUserTime();
  const tasks = search.data ?? [];
  if (tasks.length === 0) return null;
  return (
    <Command.Group
      heading="Tasks"
      className="px-1 py-1 text-caption text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
    >
      {tasks.map((task) => (
        <Command.Item
          key={task.id}
          value={`task ${task.id} ${task.title}`}
          keywords={[query]}
          onSelect={() => {
            close();
            openTask(task.id);
          }}
          className={paletteItemClass}
        >
          <CircleCheckBig aria-hidden className={icon} />
          <span
            className={`truncate font-semibold ${task.status === "done" ? "text-muted line-through" : "text-ink"}`}
          >
            {task.title}
          </span>
          {task.doAt ? (
            <span className="ml-auto shrink-0 text-caption font-normal text-muted">
              {formatWhen(task.doAt, task.hasTime, Date.now(), timeZone)}
            </span>
          ) : null}
        </Command.Item>
      ))}
    </Command.Group>
  );
}

/**
 * Puts capture in the command palette: new task, expense, income or time, the top
 * three, focus, and a search over tasks. Mounted once in the shell; renders nothing.
 */
export function TodayPalette() {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const today = useTodayDate();

  useEffect(
    () =>
      registerPaletteActions(() => [
        {
          id: "new-task",
          label: "New task",
          group: "Add",
          icon: <CircleCheckBig aria-hidden className={icon} />,
          keywords: ["add", "todo"],
          run: () => open("task:new"),
        },
        {
          id: "new-expense",
          label: "New expense",
          group: "Add",
          icon: <CircleMinus aria-hidden className={icon} />,
          keywords: ["spend", "spent", "add"],
          run: () => open("transaction:new", { type: "expense" }),
        },
        {
          id: "new-income",
          label: "New income",
          group: "Add",
          icon: <CirclePlus aria-hidden className={icon} />,
          keywords: ["salary", "earned", "add"],
          run: () => open("transaction:new", { type: "income" }),
        },
        {
          id: "log-time",
          label: "Log time",
          group: "Add",
          icon: <Timer aria-hidden className={icon} />,
          keywords: ["time entry", "hours"],
          run: () => open("time-entry:new"),
        },
        {
          id: "pick-top-three",
          label: "Pick top three",
          group: "Actions",
          icon: <Star aria-hidden className={icon} />,
          keywords: ["today", "priorities"],
          run: () => open(`top-three:${today}`),
        },
        {
          id: "start-focus",
          label: "Start focus",
          group: "Actions",
          icon: <Sprout aria-hidden className={icon} />,
          keywords: ["timer", "pomodoro"],
          run: () => void navigate({ to: "/focus" }),
        },
        {
          id: "focus-time",
          label: "Focus time this week",
          group: "Actions",
          icon: <BarChart3 aria-hidden className={icon} />,
          keywords: ["focus statistics", "stats", "deep work", "time"],
          run: () => void navigate({ to: "/plan/time", search: { view: "focus" } }),
        },
      ]),
    [open, navigate, today],
  );

  useEffect(
    () =>
      registerPaletteSearch((query, close) => (
        <TaskResults query={query} close={close} openTask={(id) => open(`task:${id}`)} />
      )),
    [open],
  );

  return null;
}

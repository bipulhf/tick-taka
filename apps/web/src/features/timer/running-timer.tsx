import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sprout, Square, Timer } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useTask } from "@/features/tasks/queries";
import { api, unwrap } from "@/lib/api";
import { formatTimer } from "@/lib/format";
import { updateToday } from "@/lib/today-cache";
import { fire } from "@/lib/write";
import { useNow } from "./use-now";

const fetchTimer = () => unwrap(api.timer.$get());
type TimerData = Awaited<ReturnType<typeof fetchTimer>>;

/** The running focus session or time entry, if any (the phone's ["timer"] key). */
export function useRunningTimer() {
  return useQuery({ queryKey: ["timer"], queryFn: fetchTimer });
}

/**
 * A compact pill in the top bar while a focus session or time entry runs: what it
 * is, the time ticking, and Stop. Hidden the rest of the time.
 */
export function RunningTimer() {
  const { data } = useRunningTimer();
  const entry = data?.running ?? null;
  const task = useTask(entry?.taskId ?? null);
  const now = useNow(1000, entry !== null);
  const client = useQueryClient();
  if (!entry) return null;
  const focus = entry.source === "focus";
  const label = task.data?.title ?? entry.note ?? (focus ? "Focus" : "Timer");
  const elapsed = formatTimer(now - entry.startedAt);
  const Icon = focus ? Sprout : Timer;

  const stop = () => {
    client.setQueryData<TimerData>(["timer"], { running: null } as TimerData);
    updateToday(client, (d) => ({ ...d, runningTimer: null }));
    fire({
      method: "POST",
      path: "/timer/stop",
      body: { id: entry.id },
      label: "Couldn't stop the timer",
    });
  };

  return (
    // A raised pill with a sky mark, not a sky fill: colour stays a small mark.
    <div className="flex h-10 shrink-0 items-center gap-1 rounded-2xl border border-line bg-card px-1">
      <Link
        to={focus ? "/focus" : "/plan/time"}
        aria-label={`${label} running, ${elapsed}. Opens the timer`}
        className="flex h-8 items-center gap-2 rounded-xl px-2 hover:bg-line/40"
      >
        <Icon aria-hidden className="size-4 shrink-0 text-sky" />
        <span className="hidden max-w-40 truncate text-callout font-semibold md:inline">
          {label}
        </span>
        <span className="text-callout font-bold tabular sm:text-body">{elapsed}</span>
      </Link>
      {/* On a phone the pill only opens the timer, which has Stop, so quick-add keeps its room. */}
      <IconButton
        icon={Square}
        label="Stop timer"
        size="sm"
        onClick={stop}
        className="hidden sm:inline-flex"
      />
    </div>
  );
}

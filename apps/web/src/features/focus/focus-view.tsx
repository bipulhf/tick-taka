import { useQuery } from "@tanstack/react-query";
import { useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { ChevronLeft, Pause, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Kbd } from "@/components/ui/kbd";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpdateSettings } from "@/features/settings/use-update-settings";
import { api, unwrap } from "@/lib/api";
import { formatTimer, plural } from "@/lib/format";
import { useSettings } from "@/lib/queries";
import { isTypingTarget } from "@/lib/ui-state";
import { focusAnnouncement } from "./focus-announcement";
import { Plant } from "./plant";
import { TaskPicker } from "./task-picker";
import { useFocus } from "./use-focus";

const LENGTHS = [15, 25, 45, 50, 90];

/** Whether a key press belongs to a control (a button's own Space, an open list). */
const ownsKey = (target: EventTarget | null) =>
  isTypingTarget(target) ||
  (target instanceof HTMLElement &&
    target.closest("button, a, [role=combobox], [role=listbox], [role=option]") !== null);

/** Pomodoro focus timer linked to a task, with Tiki's plant growing while I stay. */
export function FocusView({ taskId: initialTaskId, from }: { taskId?: string; from?: string }) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const [picked, setPicked] = useState<string | null>(initialTaskId ?? null);
  const focus = useFocus(picked);
  const { session, paused } = focus;
  const linkedTaskId = session ? session.taskId : picked;
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const task = useQuery({
    queryKey: ["task", linkedTaskId],
    queryFn: () => unwrap(api.tasks[":id"].$get({ param: { id: linkedTaskId ?? "" } })),
    enabled: Boolean(linkedTaskId),
  });

  const leave = () => {
    if (from) void navigate({ to: from });
    else if (canGoBack) router.history.back();
    else void navigate({ to: "/" });
  };

  // Space starts or pauses, Escape leaves; both stay out of the way of controls.
  const actions = useRef({ toggle: focus.toggle, leave });
  actions.current = { toggle: focus.toggle, leave };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === " " && !ownsKey(event.target)) {
        event.preventDefault();
        actions.current.toggle();
      } else if (event.key === "Escape" && !ownsKey(event.target)) {
        event.preventDefault();
        actions.current.leave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Screen readers hear the timer at milestones only, not every second.
  const announcement = focusAnnouncement(session?.phase ?? null, focus.remaining);
  const [spoken, setSpoken] = useState("");
  const announcementText = useRef(announcement?.text);
  announcementText.current = announcement?.text;
  const announcementKey = announcement?.key;
  useEffect(() => {
    setSpoken(announcementKey ? (announcementText.current ?? "") : "");
  }, [announcementKey]);

  const onBreak = session?.phase === "break";
  const drooping = session?.drooping ?? false;
  const title = task.data?.title ?? "Deep work";

  return (
    <main
      className={cx(
        "flex min-h-dvh flex-col items-center px-6 py-6 transition-colors duration-500",
        onBreak && "bg-mint/10",
      )}
    >
      <div className="flex w-full max-w-3xl items-center">
        <button
          type="button"
          onClick={leave}
          className="inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-callout font-bold text-muted hover:text-ink"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Back
        </button>
      </div>

      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 py-8">
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-caption text-muted">
            {onBreak ? "Break" : paused ? "Focus, paused" : "Focus"}
          </p>
          {linkedTaskId && task.data === undefined && !task.isError ? (
            <Skeleton className="my-0.5 h-6 w-48" />
          ) : (
            <h1 className="line-clamp-2 text-title">{title}</h1>
          )}
        </div>

        <div className="flex flex-col items-center">
          <Plant growth={focus.growth} drooping={drooping} />
          <p
            className={cx(
              "text-[4.5rem] leading-none font-extrabold tabular sm:text-[5.5rem]",
              paused && "text-muted",
            )}
          >
            {formatTimer(focus.remaining)}
          </p>
          <p className="sr-only" aria-live="polite">
            {spoken}
          </p>
          {drooping ? (
            <p className="mt-3 text-center text-body text-muted">
              Back with it. The plant perks up while you stay.
            </p>
          ) : null}
        </div>

        {session ? null : (
          <div className="flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-end">
            <TaskPicker value={picked} onChange={setPicked} />
            <Select
              label="Work"
              value={String(focus.workMinutes)}
              options={LENGTHS.map((m) => ({ value: String(m), label: plural(m, "minute") }))}
              onChange={(m) =>
                settings && update({ focus: { ...settings.focus, workMinutes: Number(m) } })
              }
              className="sm:w-40"
            />
          </div>
        )}

        <div className="flex w-full flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <Tiki
              mood={session?.phase === "work" ? "focused" : onBreak ? "relaxed" : "happy"}
              size={48}
            />
            <p className="text-body text-muted">
              {paused
                ? "Paused. Pick it up when you're ready."
                : session?.phase === "work"
                  ? "Tiki is watering the plant. Stay with it."
                  : onBreak
                    ? "Stretch, sip some water."
                    : `${focus.workMinutes} min work, ${focus.breakMinutes} min break.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {!session ? (
              <Button variant="primary" size="lg" icon={Play} onClick={focus.start}>
                Start focus
              </Button>
            ) : paused ? (
              <Button variant="primary" size="lg" icon={Play} onClick={focus.resume}>
                Resume
              </Button>
            ) : (
              <Button size="lg" icon={Pause} onClick={focus.pause}>
                Pause
              </Button>
            )}
            {session ? (
              <Button size="lg" variant="ghost" icon={Square} onClick={focus.stop}>
                {session.phase === "break" ? "Skip break" : paused ? "Stop" : "Stop and log time"}
              </Button>
            ) : null}
          </div>
          <p className="hidden items-center gap-1.5 text-caption text-muted sm:flex">
            <Kbd>Space</Kbd> {!session ? "starts" : paused ? "resumes" : "pauses"}{" "}
            <span aria-hidden>·</span>
            <Kbd>Esc</Kbd> goes back
          </p>
        </div>
      </div>
    </main>
  );
}

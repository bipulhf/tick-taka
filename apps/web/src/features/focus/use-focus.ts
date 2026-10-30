import { newId } from "@tick-taka/shared/ids";
import { useEffect, useState } from "react";
import { useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { fire } from "@/lib/write";
import { ringEnd } from "./focus-cue";
import * as rules from "./focus-session";
import { focusStore, setFocusSession } from "./focus-store";

/** The time now, ticking every second while something is running. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

/** Naming the entry makes a repeated stop a no-op instead of stopping something else. */
const stopTarget = (entryId: string | null) => (entryId ? { id: entryId } : {});

const startTimer = (entryId: string, taskId: string | null) =>
  fire({
    method: "POST",
    path: "/timer/start",
    body: { id: entryId, taskId, source: "focus" },
    label: "Couldn't start the timer",
  });

const stopTimer = (entryId: string | null, endedAt?: number) =>
  fire({
    method: "POST",
    path: "/timer/stop",
    body: { ...stopTarget(entryId), ...(endedAt ? { endedAt } : {}) },
    label: "Couldn't stop the timer",
  });

/**
 * The Pomodoro: work logs time through the server's timer (source "focus"), a pause
 * stops it and a resume starts a new stretch, the break follows on its own.
 */
export function useFocus(taskId: string | null) {
  const { data: settings } = useSettings();
  const session = useStore(focusStore);
  const running = session !== null && session.pausedRemainingMs === null;
  const now = useNow(running);
  const workMs = (settings?.focus.workMinutes ?? 25) * 60_000;
  const breakMs = (settings?.focus.breakMinutes ?? 5) * 60_000;

  const start = () => {
    const entryId = newId();
    startTimer(entryId, taskId);
    setFocusSession(rules.startWork(workMs, taskId, entryId, Date.now()));
  };

  const pause = () => {
    const current = focusStore.get();
    if (!current || current.pausedRemainingMs !== null) return;
    if (current.phase === "work") stopTimer(current.entryId);
    setFocusSession(rules.pause(current, Date.now()));
  };

  const resume = () => {
    const current = focusStore.get();
    if (!current || current.pausedRemainingMs === null) return;
    const entryId = current.phase === "work" ? newId() : null;
    if (entryId) startTimer(entryId, current.taskId);
    setFocusSession(rules.resume(current, Date.now(), entryId));
  };

  const stop = () => {
    const current = focusStore.get();
    if (current?.phase === "work" && current.entryId) stopTimer(current.entryId);
    setFocusSession(null);
  };

  // A phase ends while the page is open, or on coming back after it ended elsewhere.
  useEffect(() => {
    if (!session || !rules.hasEnded(session, now)) return;
    ringEnd(session);
    if (session.phase === "work") {
      // Logged up to the planned end, not to whenever the page noticed.
      stopTimer(session.entryId, Math.min(session.endsAt, Date.now()));
      setFocusSession(rules.startBreak(session, breakMs, session.endsAt));
    } else setFocusSession(null);
  });

  // Hiding the tab makes the plant droop; coming back within a minute revives it.
  useEffect(() => {
    const onChange = () => {
      const current = focusStore.get();
      if (current)
        setFocusSession(
          rules.withVisibility(current, document.visibilityState === "visible", Date.now()),
        );
    };
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return {
    session,
    now,
    paused: session?.pausedRemainingMs != null,
    remaining: session ? rules.remainingMs(session, now) : workMs,
    growth: rules.growthOf(session, now),
    workMinutes: settings?.focus.workMinutes ?? 25,
    breakMinutes: settings?.focus.breakMinutes ?? 5,
    start,
    pause,
    resume,
    stop,
    /** Space: start, pause or resume, whichever comes next. */
    toggle: () => {
      const current = focusStore.get();
      if (!current) start();
      else if (current.pausedRemainingMs === null) pause();
      else resume();
    },
  };
}

/**
 * The running Pomodoro: pure rules for its clock, and a store kept in localStorage
 * so a reload or a closed tab doesn't lose it.
 */
export type FocusPhase = "work" | "break";

export interface FocusSession {
  phase: FocusPhase;
  /** When the current stretch began (a resume starts a new one). */
  startedAt: number;
  endsAt: number;
  /** The whole phase, so the plant grows across a pause. */
  phaseMs: number;
  taskId: string | null;
  /** The server timer of this stretch of work; null in a break or while paused. */
  entryId: string | null;
  /** Set when the tab was hidden mid-session. */
  leftAt: number | null;
  drooping: boolean;
  /** Paused: how much of the phase was left. */
  pausedRemainingMs: number | null;
}

/** Coming back within a minute revives the plant. */
export const REVIVE_WINDOW_MS = 60_000;

export function remainingMs(session: FocusSession, now: number): number {
  return session.pausedRemainingMs ?? Math.max(0, session.endsAt - now);
}

/** 0 to 1: how far the plant has grown. Full during a break, none before starting. */
export function growthOf(session: FocusSession | null, now: number): number {
  if (!session) return 0;
  if (session.phase === "break") return 1;
  return Math.min(1, Math.max(0, 1 - remainingMs(session, now) / session.phaseMs));
}

/** The phase ran out (a paused one never does). */
export function hasEnded(session: FocusSession, now: number): boolean {
  return session.pausedRemainingMs === null && now >= session.endsAt;
}

export function startWork(
  workMs: number,
  taskId: string | null,
  entryId: string,
  now: number,
): FocusSession {
  return {
    phase: "work",
    startedAt: now,
    endsAt: now + workMs,
    phaseMs: workMs,
    taskId,
    entryId,
    leftAt: null,
    drooping: false,
    pausedRemainingMs: null,
  };
}

export function startBreak(previous: FocusSession, breakMs: number, at: number): FocusSession {
  return {
    ...previous,
    phase: "break",
    startedAt: at,
    endsAt: at + breakMs,
    phaseMs: breakMs,
    entryId: null,
    leftAt: null,
    pausedRemainingMs: null,
  };
}

export function pause(session: FocusSession, now: number): FocusSession {
  if (session.pausedRemainingMs !== null) return session;
  return { ...session, pausedRemainingMs: remainingMs(session, now), entryId: null };
}

/** Picks up where the pause left off; work gets a new server timer (`entryId`). */
export function resume(session: FocusSession, now: number, entryId: string | null): FocusSession {
  const left = session.pausedRemainingMs;
  if (left === null) return session;
  return { ...session, startedAt: now, endsAt: now + left, pausedRemainingMs: null, entryId };
}

/** The tab went to the background (droop) or came back (revive within the window). */
export function withVisibility(session: FocusSession, visible: boolean, now: number): FocusSession {
  if (session.phase !== "work" || session.pausedRemainingMs !== null) return session;
  if (!visible)
    return session.leftAt === null ? { ...session, leftAt: now, drooping: true } : session;
  if (session.leftAt === null) return session;
  return { ...session, leftAt: null, drooping: now - session.leftAt > REVIVE_WINDOW_MS };
}

/** A stored session, or null when there is none or it doesn't look like one. */
export function parseSession(raw: string | null): FocusSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<FocusSession>;
    if (
      (value.phase !== "work" && value.phase !== "break") ||
      typeof value.startedAt !== "number" ||
      typeof value.endsAt !== "number"
    )
      return null;
    return {
      phase: value.phase,
      startedAt: value.startedAt,
      endsAt: value.endsAt,
      phaseMs: typeof value.phaseMs === "number" ? value.phaseMs : value.endsAt - value.startedAt,
      taskId: value.taskId ?? null,
      entryId: value.entryId ?? null,
      leftAt: value.leftAt ?? null,
      drooping: value.drooping === true,
      pausedRemainingMs: value.pausedRemainingMs ?? null,
    };
  } catch {
    return null;
  }
}

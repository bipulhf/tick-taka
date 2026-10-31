import type { AssistantRecordKind, AssistantScreen } from "@tick-taka/shared/schemas/ai";

/**
 * What the user is looking at, sent with every chat message so "this" and "here"
 * mean something: the route (without the app's /app base) and the record open in a
 * panel, or the one picked with "Ask Tiki about this". Pure, so it can be tested.
 */

/** Panel kinds (`?panel=<kind>:<id>`) that are records Tiki can look up. */
const PANEL_RECORDS: Record<string, AssistantRecordKind> = {
  task: "task",
  transaction: "transaction",
  habit: "habit",
  goal: "goal",
  debt: "debt",
  account: "account",
  event: "event",
  project: "project",
  recurring: "recurring",
  "time-entry": "time_entry",
  routine: "routine",
};

/** Pages that are one record: /plan/project/<id>, /plan/routine/<id>. */
const PAGE_RECORDS: Record<string, AssistantRecordKind> = {
  project: "project",
  routine: "routine",
};

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const VIEW_LENGTH = 120;

export interface ScreenRecord {
  kind: AssistantRecordKind;
  id: string;
}

/** The route as the app names it: "/money/transactions", "/" for Today. */
export function viewOf(pathname: string): string {
  const path = pathname.replace(/^\/app(?=\/|$)/, "").replace(/\/+$/, "") || "/";
  return path.slice(0, VIEW_LENGTH);
}

/** The record an open panel shows, or null for a new record or a panel that isn't one. */
export function panelRecord(
  panel: { kind: string; id: string } | null | undefined,
): ScreenRecord | null {
  if (!panel) return null;
  const kind = PANEL_RECORDS[panel.kind];
  return kind && ULID.test(panel.id) ? { kind, id: panel.id } : null;
}

/** The record a page is about (a project's or a routine's own page). */
export function pageRecord(view: string): ScreenRecord | null {
  const [, area, page, id] = view.split("/");
  const kind = area === "plan" && page ? PAGE_RECORDS[page] : undefined;
  return kind && id && ULID.test(id) ? { kind, id } : null;
}

/**
 * The screen for a message. A record picked with "Ask Tiki about this" wins over the
 * open panel, which wins over the page itself.
 */
export function screenFor(
  pathname: string,
  panel: { kind: string; id: string } | null | undefined,
  about?: ScreenRecord | null,
): AssistantScreen {
  const view = viewOf(pathname);
  const record = about ?? panelRecord(panel) ?? pageRecord(view);
  return record ? { view, record: { kind: record.kind, id: record.id } } : { view };
}

/** Where a card's record opens on the web: a panel, or a routine's own page. */
export function recordTarget(
  kind: AssistantRecordKind,
  id: string,
): { panel: string } | { routineId: string } {
  if (kind === "routine") return { routineId: id };
  const panelKind = kind === "time_entry" ? "time-entry" : kind;
  return { panel: `${panelKind}:${id}` };
}

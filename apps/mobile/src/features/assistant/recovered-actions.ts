import { z } from "zod";
import type { ChatAction } from "./chat-store";

/**
 * When the assistant's stream drops, the server may have kept making changes the
 * phone never heard about. These turn GET /sync/changes since the turn started back
 * into chat actions, with Undo for anything added. Pure, so it can be tested.
 */

/** Reply of GET /sync/changes, checked before use. */
export const syncChangesSchema = z.object({
  serverTime: z.number(),
  changes: z.record(z.string(), z.array(z.unknown())),
});

/** Sync tables the assistant can write, their REST route and what to call a row. */
const TABLES: Record<string, { path: string; noun: string }> = {
  tasks: { path: "/tasks", noun: "task" },
  projects: { path: "/projects", noun: "project" },
  areas: { path: "/areas", noun: "area" },
  habits: { path: "/habits", noun: "habit" },
  routines: { path: "/routines", noun: "routine" },
  time_entries: { path: "/time-entries", noun: "time entry" },
  transactions: { path: "/transactions", noun: "transaction" },
  accounts: { path: "/accounts", noun: "account" },
  categories: { path: "/categories", noun: "category" },
  recurring: { path: "/recurring", noun: "bill" },
  goals: { path: "/goals", noun: "goal" },
  debts: { path: "/debts", noun: "debt" },
  events: { path: "/events", noun: "event" },
  shopping_items: { path: "/shopping", noun: "shopping item" },
};

const rowSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  deletedAt: z.number().nullable().optional(),
  parentId: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  person: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  amountMinor: z.number().optional(),
});

type Row = z.infer<typeof rowSchema>;

function describe(row: Row): string {
  const text = row.title ?? row.name ?? row.person ?? row.note;
  if (text) return ` "${text.length > 40 ? `${text.slice(0, 39)}…` : text}"`;
  if (row.amountMinor !== undefined)
    return ` of ${(row.amountMinor / 100).toLocaleString("en-US")}`;
  return "";
}

/** Record ids the phone already shows an action for (from the undo paths). */
export function knownIds(actions: ChatAction[]): Set<string> {
  const ids = new Set<string>();
  for (const action of actions) {
    const id = action.undo?.path.split("/")[2];
    if (id) ids.add(id);
  }
  return ids;
}

/**
 * Actions for records added or changed in the window that aren't in `known`. Added
 * records get Undo (delete). Changed ones are listed without Undo: the earlier
 * values aren't known. Subtasks of an added task are left out; undoing the task
 * removes them too.
 */
export function recoveredActions(
  changes: Record<string, unknown[]>,
  window: { since: number; until: number },
  known: Set<string>,
): ChatAction[] {
  const { since, until } = window;
  const actions: ChatAction[] = [];
  for (const [table, def] of Object.entries(TABLES)) {
    const rows = (changes[table] ?? [])
      .map((raw) => rowSchema.safeParse(raw))
      .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
      .filter(
        (row) =>
          row.updatedAt >= since && row.updatedAt <= until && !row.deletedAt && !known.has(row.id),
      );
    const added = new Set(rows.filter((row) => row.createdAt >= since).map((row) => row.id));
    for (const row of rows) {
      if (added.has(row.id)) {
        if (row.parentId && added.has(row.parentId)) continue;
        actions.push({
          summary: `Added ${def.noun}${describe(row)}`,
          undo: { method: "DELETE", path: `${def.path}/${row.id}` },
        });
      } else {
        actions.push({ summary: `Changed ${def.noun}${describe(row)}` });
      }
    }
  }
  return actions;
}

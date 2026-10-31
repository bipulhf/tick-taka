import type { AssistantScreen } from "@tick-taka/shared/schemas/ai";
import type { Caller } from "./dispatch";
import { ENTITIES, KIND_ENTITY } from "./entities";
import { listOf } from "./records";

/** The app's text goes into the prompt: one line, no control characters. */
const oneLine = (value: string, max: number) =>
  value
    .replace(/\p{Cc}+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

/** What the model may call the record. A debt is named by its direction, never by the person. */
function titleFor(kind: string, record: Record<string, unknown>): string {
  if (kind === "debt") return record.direction === "i_owe" ? "money you owe" : "money owed to you";
  for (const key of ["title", "name", "note"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return oneLine(value, 60);
  }
  return typeof record.type === "string" ? record.type : kind.replace("_", " ");
}

/**
 * One line for the system context about what the user is looking at. The record is
 * looked up through the app's own routes, as the tools do, so it can only be the
 * signed-in user's; one that isn't found is left out.
 */
export async function describeScreen(
  caller: Caller,
  screen: AssistantScreen | undefined,
): Promise<string | null> {
  if (!screen) return null;
  const view = oneLine(screen.view, 120) || "the app";
  const wanted = screen.record;
  if (!wanted) return `The user is on ${view}.`;
  // Named as the tools name it (a recurring is a bill), so the model can act on it.
  const entity = KIND_ENTITY[wanted.kind];
  const def = ENTITIES[entity];
  // Some routes have no GET /:id; their list holds every record the user can open.
  const record = def.canGet
    ? await caller.call("GET", `${def.path}/${wanted.id}`).then((r) => (r.ok ? r.data : null))
    : listOf((await caller.call("GET", def.path)).data).find((item) => item.id === wanted.id);
  if (!record || typeof record !== "object") return `The user is on ${view}.`;
  const title = titleFor(wanted.kind, record as Record<string, unknown>);
  return `The user is looking at the ${entity} “${title}” (id ${wanted.id}) on ${view}. "this", "it" and "here" mean that record.`;
}

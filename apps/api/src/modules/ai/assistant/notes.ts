import type { AiToolDefinition } from "../../../ai/client";
import type { Caller } from "./dispatch";
import { FieldError } from "./fields";
import type { Action } from "./records";

/** The same limits as the tikiNotes setting, said in words the model can act on. */
const MAX_NOTES = 30;
const MAX_NOTE = 200;

const noteParams = {
  type: "object",
  properties: { note: { type: "string" } },
  required: ["note"],
  additionalProperties: false,
};

/** What the user asked Tiki to remember, kept in their settings (Settings › Tiki and AI). */
export const NOTE_TOOLS: AiToolDefinition[] = [
  {
    name: "remember",
    description:
      "Keep a short note for later chats, only when the user asks you to remember something (a preference or a fact about them). One fact per note, in their words.",
    parameters: noteParams,
  },
  {
    name: "forget",
    description: "Remove a note you were asked to remember. note is its text, or a part of it.",
    parameters: noteParams,
  },
];

export const NOTE_NAMES = new Set(NOTE_TOOLS.map((tool) => tool.name));

const norm = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

/**
 * Runs remember or forget through PATCH /settings, with an Undo that puts the
 * previous list back.
 */
export async function runNoteTool(
  caller: Caller,
  actions: Action[],
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const note = typeof args.note === "string" ? args.note.trim().replace(/\s+/g, " ") : "";
  if (!note) throw new FieldError("note must be the text to remember");
  const current = await caller.call("GET", "/settings");
  if (!current.ok) return { error: current.error ?? "That didn't work" };
  const before = ((current.data as { tikiNotes?: unknown } | null)?.tikiNotes ?? []) as string[];

  let next: string[];
  let summary: string;
  if (name === "remember") {
    if (note.length > MAX_NOTE)
      throw new FieldError(`Keep a note under ${MAX_NOTE} characters; split or shorten it`);
    if (before.some((kept) => norm(kept) === norm(note)))
      return { ok: true, note: "Already remembered." };
    if (before.length >= MAX_NOTES)
      return {
        error: `Tiki keeps at most ${MAX_NOTES} notes. Ask the user which one to forget first.`,
      };
    next = [...before, note];
    summary = `Remembered “${note.slice(0, 60)}”`;
  } else {
    const exact = before.filter((kept) => norm(kept) === norm(note));
    const matches = exact.length ? exact : before.filter((kept) => norm(kept).includes(norm(note)));
    if (matches.length === 0)
      return { error: `No note matches that. The notes: ${JSON.stringify(before)}` };
    if (matches.length > 1)
      return { error: `Several notes match: ${JSON.stringify(matches)}. Ask which one.` };
    const [gone] = matches as [string];
    next = before.filter((kept) => kept !== gone);
    summary = `Forgot “${gone.slice(0, 60)}”`;
  }
  const result = await caller.call("PATCH", "/settings", { tikiNotes: next });
  if (!result.ok) return { error: result.error ?? "That didn't work" };
  actions.push({
    summary,
    undo: { method: "PATCH", path: "/settings", body: { tikiNotes: before } },
  });
  return { ok: true, notes: next.length };
}

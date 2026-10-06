import { idSchema } from "@tick-taka/shared/schemas/common";
import { FieldError } from "./fields";

/** How the phone can reverse one change: the request to send, with a fresh edit time for PATCH. */
export interface Undo {
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

export interface Action {
  summary: string;
  undo?: Undo;
}

/**
 * A deletion the assistant asked for. Nothing is deleted on the server's side:
 * the phone shows these and sends the DELETEs only when the user taps Delete.
 */
export interface PendingDelete {
  summary: string;
  /** The record's route; DELETE removes it and POST `${path}/restore` brings it back. */
  path: string;
}

/**
 * A money change the assistant proposed (when the phone asked for drafts).
 * Nothing is saved: on the user's tap the phone sends exactly this request
 * (ids are already in the body, so a retry never duplicates; a PATCH gets the
 * edit time added, as for Undo), and `undo` reverses it like an action's.
 */
export interface Draft {
  summary: string;
  method: "POST" | "PATCH" | "PUT";
  path: string;
  body: Record<string, unknown>;
  undo?: Undo;
  /** For the card, when the body doesn't show it plainly (a budget line inside a month). */
  amountMinor?: number;
  categoryId?: string;
}

/** What a write returns to the model when it became a draft instead. */
export const DRAFTED = {
  ok: true,
  draft: true,
  note: "Not saved yet. The user confirms it on screen; tell them it is waiting for their tap.",
};

export const label = (
  record: Record<string, unknown> | null | undefined,
  entity: string,
): string => {
  if (!record) return entity.replace("_", " ");
  const text = record.title ?? record.name ?? record.note ?? record.person;
  return typeof text === "string" && text ? `“${text.slice(0, 60)}”` : entity.replace("_", " ");
};

export const listOf = (data: unknown): Record<string, unknown>[] =>
  (Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? (data as { items: unknown[] }).items
      : []) as Record<string, unknown>[];

export const isId = (value: unknown): value is string => idSchema.safeParse(value).success;

/** Ids go into request paths, so only real record ids (ULIDs) are accepted. */
export function idOf(value: unknown): string {
  if (!isId(value)) throw new FieldError("id must be a record id from find");
  return value;
}

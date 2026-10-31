import {
  type AssistantRecordKind,
  type AssistantScreen,
  assistantScreenSchema,
} from "@tick-taka/shared/schemas/ai";
import { idSchema } from "@tick-taka/shared/schemas/common";
import type { Href } from "expo-router";

/**
 * What Tiki is told the user is looking at. The chat is its own screen, so the
 * screen it was opened from travels in its params (`/assistant?view=…&kind=…&id=…`).
 * Pure, so it can be tested.
 */

type Params = Record<string, string | string[] | undefined>;

/** Record sheets, by their route, and the kind Tiki knows each one as. */
const RECORD_ROUTES: { path: string[]; kind: AssistantRecordKind }[] = [
  { path: ["task"], kind: "task" },
  { path: ["transaction"], kind: "transaction" },
  { path: ["habit"], kind: "habit" },
  { path: ["goal"], kind: "goal" },
  { path: ["debt"], kind: "debt" },
  { path: ["account"], kind: "account" },
  { path: ["event"], kind: "event" },
  { path: ["project"], kind: "project" },
  { path: ["money", "recurring"], kind: "recurring" },
  { path: ["shopping-item"], kind: "shopping_item" },
  { path: ["routine"], kind: "routine" },
];

const VIEW_LENGTH = 120;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/** A ULID, or nothing: "new" sheets and odd params name no record. */
const recordId = (value: string | undefined) =>
  value && idSchema.safeParse(value).success ? value : undefined;

/** The record a route shows, from its path ("/task/01H…") or its params ("/time-entry?id=…"). */
function recordOf(parts: string[], params: Params): AssistantScreen["record"] {
  if (parts.length === 1 && parts[0] === "time-entry") {
    const id = recordId(first(params.id));
    return id ? { kind: "time_entry", id } : undefined;
  }
  for (const route of RECORD_ROUTES) {
    if (parts.length !== route.path.length + 1) continue;
    if (!route.path.every((part, i) => parts[i] === part)) continue;
    const id = recordId(parts.at(-1));
    return id ? { kind: route.kind, id } : undefined;
  }
  return undefined;
}

/** The screen at `pathname` (as usePathname gives it), with the record it shows, if any. */
export function screenFromRoute(pathname: string, params: Params = {}): AssistantScreen {
  const path = pathname.split(/[?#]/, 1)[0] ?? "";
  const parts = path.split("/").filter((part) => part && !part.startsWith("("));
  const view = `/${parts.join("/")}`.slice(0, VIEW_LENGTH);
  const record = recordOf(parts, params);
  return record ? { view, record } : { view };
}

/** The chat's route, carrying the screen it was opened from. */
export function assistantHref(screen: AssistantScreen): Href {
  return {
    pathname: "/assistant",
    params: {
      view: screen.view,
      ...(screen.record ? { kind: screen.record.kind, id: screen.record.id } : {}),
    },
  };
}

/**
 * The screen the chat was opened from, back out of its params. Opened from nowhere
 * in particular (the widget, a shortcut), the chat itself is the view.
 */
export function screenFromParams(params: Params): AssistantScreen {
  const view = (first(params.view) || "/assistant").replace(/\s+/g, " ").slice(0, VIEW_LENGTH);
  const parsed = assistantScreenSchema.safeParse({
    view,
    record: { kind: first(params.kind), id: first(params.id) },
  });
  // No record, or one that doesn't check out: the view alone.
  return parsed.success ? parsed.data : { view };
}

/** Where a record card leads: the record's own sheet. */
export function recordHref(kind: AssistantRecordKind, id: string): Href {
  switch (kind) {
    case "task":
      return `/task/${id}`;
    case "transaction":
      return `/transaction/${id}`;
    case "habit":
      return `/habit/${id}`;
    case "goal":
      return `/goal/${id}`;
    case "debt":
      return `/debt/${id}`;
    case "account":
      return `/account/${id}`;
    case "event":
      return `/event/${id}`;
    case "project":
      return `/project/${id}`;
    case "recurring":
      return `/money/recurring/${id}`;
    case "shopping_item":
      return `/shopping-item/${id}`;
    case "time_entry":
      return `/time-entry?id=${id}`;
    case "routine":
      return `/routine/${id}`;
  }
}

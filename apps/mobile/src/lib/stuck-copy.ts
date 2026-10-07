import { plural } from "./format";
import { type OutboxEntry, type OutboxRequest, recordPath } from "./outbox-policy";

/**
 * Words for writes the server kept failing on, by what they are ("Change to an
 * account", "2 expenses") rather than by their failure label ("Couldn't save"), so
 * the card and the Discard snackbar say what is waiting and what a tap drops.
 */

/** What a route's records are called: one, many. */
const NOUNS: Record<string, readonly [string, string]> = {
  accounts: ["account", "accounts"],
  areas: ["area", "areas"],
  budgets: ["budget line", "budget lines"],
  categories: ["category", "categories"],
  "category-rules": ["category rule", "category rules"],
  debts: ["debt", "debts"],
  events: ["event", "events"],
  goals: ["goal", "goals"],
  habits: ["habit", "habits"],
  projects: ["project", "projects"],
  recurring: ["bill", "bills"],
  reviews: ["review", "reviews"],
  routines: ["routine", "routines"],
  settings: ["setting", "settings"],
  shopping: ["shopping item", "shopping items"],
  tasks: ["task", "tasks"],
  "time-entries": ["time entry", "time entries"],
  transactions: ["transaction", "transactions"],
};

const TRANSACTION_KINDS: Record<string, readonly [string, string]> = {
  expense: ["expense", "expenses"],
  income: ["income", "incomes"],
  transfer: ["transfer", "transfers"],
};

const segmentsOf = (request: OutboxRequest) =>
  (request.path.split("?", 1)[0] ?? "").split("/").filter(Boolean);
const words = (segment: string) => segment.replaceAll("-", " ");
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const withArticle = (noun: string) => `${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun}`;

function bodyField(request: OutboxRequest, key: string): unknown {
  const body = request.body;
  return body && typeof body === "object" ? (body as Record<string, unknown>)[key] : undefined;
}

function nounOf(request: OutboxRequest): readonly [string, string] {
  const route = segmentsOf(request)[0] ?? "";
  const kind = bodyField(request, "type");
  if (route === "transactions" && typeof kind === "string" && TRANSACTION_KINDS[kind])
    return TRANSACTION_KINDS[kind];
  const known = NOUNS[route];
  if (known) return known;
  const fallback = words(route) || "item";
  return [fallback, fallback];
}

/** Whether the write brings a new record into being (a POST to a collection). */
const isCreate = (request: OutboxRequest) =>
  request.method === "POST" && recordPath(request) === null && segmentsOf(request).length === 1;

/** One write in words: "New expense", "Change to an account", "Payment of a bill". */
export function describeWrite(request: OutboxRequest): string {
  const [one] = nounOf(request);
  const segments = segmentsOf(request);
  const record = recordPath(request);
  if (request.method === "PATCH" || request.method === "PUT")
    return `Change to ${withArticle(one)}`;
  if (request.method === "DELETE") return `Deleting ${withArticle(one)}`;
  if (isCreate(request)) return `New ${one}`;
  const action = segments.at(-1) ?? "";
  if (!record) return capitalize(segments.map(words).join(" ")); // "Timer start"
  if (action === "restore") return `Restore of ${withArticle(one)}`;
  if (action === "pay") return bodyField(request, "skip") ? "Skip of a bill" : "Payment of a bill";
  if (action === "unpay") return "Undo of a bill payment";
  return `${capitalize(words(action))} on ${withArticle(one)}`; // "Balance check on an account"
}

/** The writes waiting with a stuck one, counted by kind: "2 expenses, 1 task change". */
export function describeWaiting(requests: readonly OutboxRequest[]): string {
  const counts = new Map<string, { count: number; one: string; many: string }>();
  for (const request of requests) {
    const [one, many] = nounOf(request);
    const kind = isCreate(request)
      ? { one, many }
      : { one: `${one} change`, many: `${one} changes` };
    const seen = counts.get(kind.one) ?? { count: 0, ...kind };
    seen.count += 1;
    counts.set(kind.one, seen);
  }
  return [...counts.values()].map(({ count, one, many }) => plural(count, one, many)).join(", ");
}

/** A stuck group on the card: "Change to an account · 1 account change waiting with it". */
export function describeGroup([head, ...rest]: readonly OutboxEntry[]): string {
  if (!head) return "";
  const what = describeWrite(head.request);
  return rest.length
    ? `${what} · ${describeWaiting(rest.map((e) => e.request))} waiting with it`
    : what;
}

/** The snackbar after Discard, naming everything the tap dropped. */
export function describeDiscard([head, ...rest]: readonly OutboxEntry[]): string {
  if (!head) return "Discarded";
  const what = describeWrite(head.request);
  return rest.length
    ? `Discarded: ${what}, with ${describeWaiting(rest.map((e) => e.request))}`
    : `Discarded: ${what}`;
}

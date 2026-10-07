import { z } from "zod";

/**
 * The outbox's rules, kept free of React Native so they can be tested on their own:
 * which failures wait and retry, which are final, and how a queued edit follows the
 * record it edits.
 */

export type HttpMethod = "POST" | "PATCH" | "PUT" | "DELETE";

export interface OutboxRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
  /** Shown if the server rejects the write. */
  label?: string;
}

export interface OutboxEntry {
  /** Local id of the queued write, not of any record. */
  id: string;
  request: OutboxRequest;
  queuedAt: number;
  /** Failed attempts so far. */
  attempts: number;
  /** An earlier attempt may have reached the server (timeout, dropped reply, 5xx, app killed). */
  maybeDelivered: boolean;
  /** Server errors in a row (see isServerFault); missing on entries from older builds. */
  serverFailures?: number;
  /**
   * Set aside together with this stuck write (its entry id), because it can't go ahead
   * of it (see tiedTo). Retry and Discard act on the whole group.
   */
  stuckWith?: string;
}

/** What went wrong with one attempt, reduced to what the policy needs. */
export interface FailureInfo {
  /** HTTP status, when the server answered. */
  status?: number;
  /** No answer at all: offline, timed out, or the server is down. */
  unreachable?: boolean;
}

/**
 * retry: keep it and try again later. session: the sign-in expired; keep it and wait.
 * applied: the server already has this change (a retry of a request that got through).
 * reject: the server refused it for good (validation, not found).
 */
export type FailureKind = "retry" | "session" | "applied" | "reject";

/** Waits between retries: 1 s, 2 s, 4 s … capped at a minute. Retries never stop on their own. */
export function retryDelay(attempts: number): number {
  return Math.min(60_000, 1000 * 2 ** Math.max(0, attempts - 1));
}

/**
 * Action routes that answer a repeat with an error even though the first call worked.
 * Seeing one of these after a possibly delivered attempt means the change is done.
 */
function repeatOfDelivered(request: OutboxRequest, status: number): boolean {
  const { method, path } = request;
  if (method !== "POST") return false;
  if (status === 409 && path === "/timer/stop") return true;
  if (status === 400 && path === "/shopping/checkout") return true;
  return false;
}

/** Errors whose end state is what the user asked for: the record is gone, or it's back. */
function alreadyInWantedState(request: OutboxRequest, status: number): boolean {
  if (request.method === "DELETE" && status === 404) return true;
  return request.method === "POST" && request.path.endsWith("/restore") && status === 409;
}

export function classifyFailure(entry: OutboxEntry, failure: FailureInfo): FailureKind {
  if (failure.unreachable) return "retry";
  const status = failure.status;
  if (status === undefined) return "reject";
  if (status === 401) return "session";
  if (status >= 500 || status === 408 || status === 429) return "retry";
  if (alreadyInWantedState(entry.request, status)) return "applied";
  if (entry.maybeDelivered && repeatOfDelivered(entry.request, status)) return "applied";
  return "reject";
}

/**
 * After this many server errors in a row, a write is set aside as stuck so the ones
 * queued behind it can go. With the backoff that is about two minutes of trying.
 */
export const STUCK_AFTER = 8;

/**
 * Our API answered with a 5xx: the same request is likely to fail the same way.
 * 503 means the API is down for a moment, and a proxy's error page counts as
 * unreachable (see outbox.ts), so neither of those ever makes a write stuck.
 */
export function isServerFault(failure: FailureInfo): boolean {
  if (failure.unreachable || failure.status === undefined) return false;
  return failure.status >= 500 && failure.status !== 503;
}

/** Record ids are ULIDs, made on the phone. */
const RECORD_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const pathOf = (request: OutboxRequest): string => request.path.split("?", 1)[0] ?? "";

/**
 * The records a write brings into being: a POST's `id`, or its `transactionId` (a
 * bill's pay, a checkout). Until it lands the server has never heard of them.
 */
export function createdIds(request: OutboxRequest): string[] {
  const body = request.body;
  if (request.method !== "POST" || !body || typeof body !== "object" || Array.isArray(body))
    return [];
  const ids: string[] = [];
  for (const key of ["id", "transactionId"]) {
    const id = (body as Record<string, unknown>)[key];
    if (typeof id === "string" && id) ids.push(id);
  }
  return ids;
}

/**
 * The record a write acts on: its path up to the last record id (`/accounts/<id>`
 * for an edit, a delete, a restore or `/accounts/<id>/balance-check`;
 * `/budgets/2026-10/<category>` for a budget line). Null for a write to a collection.
 */
export function recordPath(request: OutboxRequest): string | null {
  const segments = pathOf(request).split("/");
  for (let i = segments.length - 1; i > 0; i--)
    if (RECORD_ID.test(segments[i] ?? "")) return segments.slice(0, i + 1).join("/");
  return null;
}

function bodyMentions(value: unknown, ids: ReadonlySet<string>, depth: number): boolean {
  if (typeof value === "string") return ids.has(value);
  if (!value || typeof value !== "object" || depth > 3) return false;
  return Object.values(value).some((v) => bodyMentions(v, ids, depth + 1));
}

/** Whether a write names any of these records: in its path, or anywhere in its body. */
function mentionsAny(request: OutboxRequest, ids: ReadonlySet<string>): boolean {
  if (ids.size === 0) return false;
  const inPath = pathOf(request)
    .split("/")
    .some((s) => ids.has(s));
  return inPath || bodyMentions(request.body, ids, 0);
}

/** What a stuck group holds back: the records it creates, and the records it acts on. */
export interface GroupTies {
  created: Set<string>;
  records: Set<string>;
}

/** The ties of these writes (a stuck group, oldest first). */
export function tiesOf(requests: readonly OutboxRequest[]): GroupTies {
  const ties: GroupTies = { created: new Set(), records: new Set() };
  for (const request of requests) addTies(ties, request);
  return ties;
}

export function addTies(ties: GroupTies, request: OutboxRequest): void {
  for (const id of createdIds(request)) ties.created.add(id);
  const record = recordPath(request);
  if (record) ties.records.add(record);
}

/**
 * Whether a write can't go ahead of a stuck group. It can't when it names a record the
 * group creates, anywhere (an edit of a new task, an expense in a new account): sent
 * first, it would get 404 or invalid_reference and be lost. Nor when it acts on the
 * same record as the group, or under it (a delete after a stuck edit, a bill's unpay
 * after its pay): it would land out of order. A write that only refers to a record
 * the server already has (an expense in an account whose rename is stuck) goes on;
 * if it fails, it fails on its own.
 */
export function tiedTo(request: OutboxRequest, ties: GroupTies): boolean {
  if (mentionsAny(request, ties.created)) return true;
  const path = pathOf(request);
  for (const record of ties.records)
    if (path === record || path.startsWith(`${record}/`)) return true;
  return false;
}

/** Whether a failed attempt could have changed data on the server before it failed. */
export function mayHaveReachedServer(failure: FailureInfo): boolean {
  return Boolean(failure.unreachable) || (failure.status !== undefined && failure.status >= 500);
}

interface StampedRow {
  id: string;
  updatedAt: number;
}

function isStampedRow(value: unknown): value is StampedRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" && typeof row.updatedAt === "number";
}

/** A row, or the rows of a list (bulk moves answer with lists). */
const rowsIn = (value: unknown): StampedRow[] =>
  Array.isArray(value) ? value.filter(isStampedRow) : isStampedRow(value) ? [value] : [];

/**
 * Records in a write's reply: the reply itself, a list of rows, or rows and lists one
 * level down (`{ started, stopped }`, `{ moved: [...] }`, `{ tasks: [...] }`).
 */
export function stampedRows(response: unknown): StampedRow[] {
  if (isStampedRow(response) || Array.isArray(response)) return rowsIn(response);
  if (!response || typeof response !== "object") return [];
  return Object.values(response).flatMap(rowsIn);
}

/**
 * The server stamps a record it writes with the time the write arrived, which for a
 * write queued offline is the replay time. An edit made on the phone after a create or
 * a bulk move but queued behind it carries an earlier time and would lose to it (last
 * write wins). Once that write lands, queued edits of the records in its reply move up
 * to their stamp. Returns the entries that changed.
 */
export function followCreatedRecords(entries: OutboxEntry[], response: unknown): OutboxEntry[] {
  const rows = stampedRows(response);
  const changed: OutboxEntry[] = [];
  if (rows.length === 0) return changed;
  for (const entry of entries) {
    const { method, path, body } = entry.request;
    if (method !== "PATCH" || !body || typeof body !== "object") continue;
    const editedAt = (body as { updatedAt?: unknown }).updatedAt;
    if (typeof editedAt !== "number") continue;
    const row = rows.find((r) => path.endsWith(`/${r.id}`));
    if (!row || editedAt >= row.updatedAt) continue;
    entry.request = { ...entry.request, body: { ...body, updatedAt: row.updatedAt } };
    changed.push(entry);
  }
  return changed;
}

const requestSchema = z.object({
  method: z.enum(["POST", "PATCH", "PUT", "DELETE"]),
  path: z.string().startsWith("/"),
  body: z.unknown().optional(),
  label: z.string().optional(),
});

const entrySchema = z.object({
  id: z.string(),
  request: requestSchema,
  queuedAt: z.number(),
  attempts: z.number().int().min(0),
  maybeDelivered: z.boolean(),
  serverFailures: z.number().int().min(0).optional(),
  stuckWith: z.string().optional(),
});

const persistedSchema = z.object({
  version: z.literal(1),
  userId: z.string().nullable(),
  entries: z.array(z.unknown()),
  stuck: z.array(z.unknown()).optional(),
});

export interface PersistedOutbox {
  version: 1;
  /** Whose writes these are: a different account signing in must not send them. */
  userId: string | null;
  entries: OutboxEntry[];
  /** Writes the server kept failing on, waiting for the user to retry or discard them. */
  stuck?: OutboxEntry[];
}

function parseEntries(items: unknown[]): OutboxEntry[] {
  const entries: OutboxEntry[] = [];
  for (const item of items) {
    const entry = entrySchema.safeParse(item);
    if (entry.success) entries.push(entry.data as OutboxEntry);
  }
  return entries;
}

/**
 * Reads a saved queue. Entries that don't match the shape (from a broken write or an
 * old build) are skipped one by one rather than throwing the whole queue away.
 */
export function parsePersistedOutbox(raw: unknown): PersistedOutbox | null {
  const outer = persistedSchema.safeParse(raw);
  if (!outer.success) return null;
  return {
    version: 1,
    userId: outer.data.userId,
    entries: parseEntries(outer.data.entries),
    stuck: parseEntries(outer.data.stuck ?? []),
  };
}

/** Outbox writes TanStack Query persisted before the outbox had its own storage. */
export function legacyOutboxRequests(raw: unknown): OutboxRequest[] {
  const mutations = (raw as { clientState?: { mutations?: unknown } } | null)?.clientState
    ?.mutations;
  if (!Array.isArray(mutations)) return [];
  const requests: OutboxRequest[] = [];
  for (const mutation of mutations as {
    mutationKey?: unknown;
    state?: { status?: unknown; variables?: unknown };
  }[]) {
    if (!Array.isArray(mutation.mutationKey) || mutation.mutationKey[0] !== "outbox") continue;
    if (mutation.state?.status !== "pending") continue;
    const request = requestSchema.safeParse(mutation.state.variables);
    if (request.success) requests.push(request.data as OutboxRequest);
  }
  return requests;
}

import { type HttpMethod, send } from "./api";
import { friendlyError } from "./error-copy";
import { scheduleRefresh } from "./query-client";
import { notify, notifyError } from "./toast";

export interface WriteRequest {
  method: HttpMethod;
  /** The route, e.g. `/tasks/<id>`; also decides which views refresh after it. */
  path: string;
  body?: unknown;
  /** Says what failed, before the reason: "Couldn't save the task". */
  label?: string;
}

/**
 * Sends one change to the server and refreshes the views it can change. On the web
 * nothing is queued: a failure is said in a toast (with Retry) and rethrown, so a
 * panel can stay open with what was typed.
 */
export async function write<T = unknown>(request: WriteRequest): Promise<T> {
  try {
    const result = await send<T>(request.method, request.path, request.body);
    scheduleRefresh(request.path);
    return result;
  } catch (error) {
    // Whatever the cache guessed (an optimistic tick) goes back to the server's truth.
    scheduleRefresh(request.path);
    notifyError(`${request.label ? `${request.label}. ` : ""}${friendlyError(error, "save")}`, {
      label: "Retry",
      onPress: () => void write(request).catch(() => {}),
    });
    throw error;
  }
}

/** For taps that don't wait: the toast already says what went wrong. */
export function fire(request: WriteRequest): void {
  write(request).catch(() => {});
}

/**
 * Deletes one record with Undo in the toast instead of an "Are you sure?" dialog.
 * `path` is the record's route, e.g. `/goals/<id>`; every such route has a matching
 * `POST <path>/restore`.
 */
export async function remove(path: string, name: string): Promise<void> {
  await write({ method: "DELETE", path, label: `Couldn't delete ${name}` });
  notify(`Deleted ${name}`, {
    label: "Undo",
    onPress: () => fire({ method: "POST", path: `${path}/restore`, label: "Couldn't undo" }),
  });
}

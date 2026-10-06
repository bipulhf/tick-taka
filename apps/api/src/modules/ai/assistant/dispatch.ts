/** Sends a request through the app's own routes, so the assistant gets the same validation and side effects as the phone. */
export type Dispatch = (path: string, init: RequestInit) => Promise<Response>;

export interface CallResult {
  ok: boolean;
  status: number;
  data: unknown;
  error?: string;
}

export interface Caller {
  call(method: string, path: string, body?: unknown): Promise<CallResult>;
}

/**
 * True when the path is already in its final form: URL parsing would not move it
 * elsewhere (no `..` or `.` segments, backslashes or encoded slashes).
 */
export function isPlainPath(path: string): boolean {
  const pathname = path.split("?")[0]!;
  if (!pathname.startsWith("/") || pathname.startsWith("//") || /%2f|%5c/i.test(pathname))
    return false;
  return new URL(path, "http://localhost").pathname === pathname;
}

/** Binds the dispatcher to the signed-in user's token for one assistant turn. */
export function createCaller(dispatch: Dispatch, authorization: string): Caller {
  return {
    async call(method, path, body) {
      // Paths include ids the model chose; never let one resolve to another route.
      if (!isPlainPath(path))
        return { ok: false, status: 400, data: null, error: "That id isn't valid" };
      const response = await dispatch(path, {
        method,
        headers: { authorization, "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data: unknown = await response.json().catch(() => null);
      if (response.ok) return { ok: true, status: response.status, data };
      const error = (data as { error?: { message?: string; details?: unknown } } | null)?.error;
      const details = error?.details ? ` ${JSON.stringify(error.details)}` : "";
      return {
        ok: false,
        status: response.status,
        data,
        error: `${error?.message ?? `HTTP ${response.status}`}${details}`.slice(0, 600),
      };
    },
  };
}

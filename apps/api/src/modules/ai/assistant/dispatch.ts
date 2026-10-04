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

/** Binds the dispatcher to the signed-in user's token for one assistant turn. */
export function createCaller(dispatch: Dispatch, authorization: string): Caller {
  return {
    async call(method, path, body) {
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

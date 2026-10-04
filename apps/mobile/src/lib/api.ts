import type { AppType } from "@tick-taka/api/app-type";
import { hc } from "hono/client";
import { signOut, tokenStore } from "./auth";
import { API_URL } from "./config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const authHeaders = (): Record<string, string> => {
  const token = tokenStore.get();
  return token ? { authorization: `Bearer ${token}` } : {};
};

/** Typed Hono RPC client: every route and response type comes from the server. */
export const api = hc<AppType>(API_URL, { headers: authHeaders });

interface JsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

async function toError(response: JsonResponse): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: { code: string; message: string };
  } | null;
  if (response.status === 401) void signOut();
  return new ApiError(
    response.status,
    body?.error?.code ?? "http_error",
    body?.error?.message ?? `Request failed (${response.status})`,
  );
}

type SuccessBody<R> = R extends { json(): Promise<infer T> } ? T : never;

/** Unwraps an RPC response: typed JSON of the success branch, ApiError otherwise. */
export async function unwrap<R extends JsonResponse>(request: Promise<R>): Promise<SuccessBody<R>> {
  const response = await request;
  if (!response.ok) throw await toError(response);
  return (await response.json()) as SuccessBody<R>;
}

export type HttpMethod = "POST" | "PATCH" | "PUT" | "DELETE";

/** Plain JSON request, used by the offline outbox where the route is data, not code. */
export async function send<T = unknown>(
  method: HttpMethod | "GET",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await toError(response);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function apiUrl(path: string): string {
  return `${API_URL}${path}`;
}

import type { AppType } from "@tick-taka/api/app-type";
import { hc } from "hono/client";
import type { SuccessStatusCode } from "hono/utils/http-status";
import { API_URL } from "./config";
import { apiUrl, kyFetch, request } from "./http";

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

/** Typed Hono RPC client: every route and response type comes from the server; requests go through ky. */
export const api = hc<AppType>(API_URL, { fetch: kyFetch });

interface JsonResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

async function toError(response: JsonResponse): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: { code: string; message: string };
  } | null;
  return new ApiError(
    response.status,
    body?.error?.code ?? "http_error",
    body?.error?.message ?? `Request failed (${response.status})`,
  );
}

/** Body type of the 2xx branches only; validation-error branches are dropped. */
type SuccessBody<R> = R extends { status: infer S; json(): Promise<infer T> }
  ? S extends SuccessStatusCode
    ? T
    : never
  : never;

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
  const response = await request(apiUrl(path), {
    method,
    ...(body === undefined ? {} : { json: body }),
  });
  if (!response.ok) throw await toError(response);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

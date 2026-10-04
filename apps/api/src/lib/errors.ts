import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Every error leaves the API as `{ "error": { "code", "message" } }`. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (entity: string) => new AppError(404, "not_found", `${entity} not found`);
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "bad_request", message, details);
export const conflict = (message: string) => new AppError(409, "conflict", message);
export const unauthorized = (message = "Sign in again") =>
  new AppError(401, "unauthorized", message);

export function errorBody(code: string, message: string, details?: unknown) {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

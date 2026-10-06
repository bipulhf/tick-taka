import type { ErrorHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { AppError, errorBody } from "../lib/errors";
import { errorFields, log, requestIdOf } from "../lib/log";

function sqliteCode(error: unknown): string | undefined {
  for (let current: unknown = error; current; current = (current as { cause?: unknown }).cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && code.startsWith("SQLITE_")) return code;
  }
  return undefined;
}

export const onError: ErrorHandler = (error, c) => {
  if (error instanceof AppError)
    return c.json(errorBody(error.code, error.message, error.details), error.status);
  if (error instanceof HTTPException) {
    return c.json(errorBody("http_error", error.message || "Request failed"), error.status);
  }
  const code = sqliteCode(error);
  if (code === "SQLITE_CONSTRAINT_FOREIGNKEY") {
    return c.json(errorBody("invalid_reference", "A linked record doesn't exist"), 400);
  }
  if (code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT_PRIMARYKEY") {
    return c.json(errorBody("conflict", "That record already exists"), 409);
  }
  // A row the table's own rules refuse will be refused every time: a 400, so the
  // phone drops the write and says so instead of retrying it forever as a 5xx.
  if (code === "SQLITE_CONSTRAINT_CHECK" || code === "SQLITE_CONSTRAINT_NOTNULL") {
    log("warn", "constraint refused a write", {
      reqId: requestIdOf(c.req.raw),
      method: c.req.method,
      path: c.req.path,
      ...errorFields(error),
    });
    return c.json(errorBody("invalid_data", "Those values don't fit together"), 400);
  }
  log("error", "unhandled error", {
    reqId: requestIdOf(c.req.raw),
    method: c.req.method,
    path: c.req.path,
    ...errorFields(error),
  });
  return c.json(errorBody("internal_error", "Something went wrong on the server"), 500);
};

export const onNotFound: NotFoundHandler = (c) =>
  c.json(errorBody("not_found", "No such endpoint"), 404);

import { createHmac } from "node:crypto";

export type LogLevel = "info" | "warn" | "error";
export type LogSink = (level: LogLevel, line: string) => void;

const consoleSink: LogSink = (level, line) => {
  if (level === "error") console.error(line);
  else console.log(line);
};
// Tests stay quiet unless they capture lines with setLogSink.
let sink: LogSink = process.env.NODE_ENV === "test" ? () => {} : consoleSink;

/** Swaps where log lines go (tests capture them); returns the previous sink. */
export function setLogSink(next: LogSink): LogSink {
  const previous = sink;
  sink = next;
  return previous;
}

/**
 * One JSON line per event, for pm2 logs and grep/jq. Never pass request
 * bodies, tokens or query strings in `fields`.
 */
export function log(level: LogLevel, msg: string, fields: Record<string, unknown> = {}): void {
  sink(level, JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields }));
}

export function errorFields(error: unknown): Record<string, unknown> {
  return error instanceof Error
    ? { error: `${error.name}: ${error.message}`, stack: error.stack }
    : { error: String(error) };
}

/** A stable, non-reversible tag for a user id, so logs can be grouped without naming anyone. */
export function userTag(userId: string, secret: string): string {
  return createHmac("sha256", secret).update(userId).digest("hex").slice(0, 12);
}

/**
 * Logs a promise rejection nobody handled instead of letting Bun exit on it. With
 * pm2 restarting into the same failure, one bad value would otherwise keep the
 * API down for everyone.
 */
export function installCrashLogging(
  target: {
    on(event: "unhandledRejection", handler: (reason: unknown) => void): unknown;
  } = process,
): void {
  target.on("unhandledRejection", (reason) =>
    log("error", "unhandled rejection", errorFields(reason)),
  );
}

// Per-request facts the request logger needs from deeper middleware.
const requestIds = new WeakMap<Request, string>();
const requestUsers = new WeakMap<Request, string>();

export const setRequestId = (request: Request, id: string) => requestIds.set(request, id);
export const requestIdOf = (request: Request) => requestIds.get(request);
export const setRequestUser = (request: Request, userId: string) =>
  requestUsers.set(request, userId);
export const requestUserOf = (request: Request) => requestUsers.get(request);

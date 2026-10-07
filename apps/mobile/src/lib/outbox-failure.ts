import { ApiError } from "./api";
import { ServerUnreachableError } from "./http";
import type { FailureInfo } from "./outbox-policy";

/** Turns what a send threw into what the outbox policy needs: a status, or "not reached". */
export function describeFailure(error: unknown): FailureInfo {
  if (error instanceof ServerUnreachableError) return { unreachable: true };
  if (error instanceof ApiError) {
    // Not our API's error shape: a captive portal or proxy answered, not the server.
    if (error.code === "http_error" && error.status !== 401) return { unreachable: true };
    return { status: error.status };
  }
  // A 200 that isn't JSON is a login page in front of the server, not a reply.
  if (error instanceof SyntaxError) return { unreachable: true };
  return {};
}

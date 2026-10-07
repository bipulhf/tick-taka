import { ApiError } from "./api";
import { ServerUnreachableError } from "./http";
import type { FailureInfo } from "./outbox-policy";

/** Payload, URL or headers too large (Nginx's client_max_body_size answers 413). */
const TOO_LARGE = new Set([413, 414, 431]);

/** Turns what a send threw into what the outbox policy needs: a status, or "not reached". */
export function describeFailure(error: unknown): FailureInfo {
  if (error instanceof ServerUnreachableError) return { unreachable: true };
  if (error instanceof ApiError) {
    // Too large for the proxy or the server: sending it again can never work.
    if (TOO_LARGE.has(error.status)) return { status: error.status };
    // Not our API's error shape: a captive portal or proxy answered, not the server.
    if (error.code === "http_error" && error.status !== 401) return { unreachable: true };
    return { status: error.status };
  }
  // A 200 that isn't JSON is a login page in front of the server, not a reply.
  if (error instanceof SyntaxError) return { unreachable: true };
  return {};
}

/**
 * The one place an error becomes words on screen. Raw messages are written for
 * developers ("Request failed (500)", the server's URL, a zod path); the person
 * holding the phone gets short, calm copy instead. Pure, so it can be tested.
 */

/**
 * What was going on when it failed:
 * - save: a write that the outbox keeps and retries,
 * - load: reading a screen's data,
 * - action: anything run once, now (AI, uploads, exports, deleting the account),
 * - signIn: trading Google's sign-in for a session on the login screen.
 */
export type ErrorContext = "save" | "load" | "action" | "signIn";

const OFFLINE: Record<ErrorContext, string> = {
  save: "Saved on this phone. It'll sync when you're back online.",
  load: "Can't connect right now. Pull down to try again.",
  action: "Can't connect right now. Check your internet and try again.",
  signIn: "Can't connect right now. Check your internet and try again.",
};

const SERVER: Record<ErrorContext, string> = {
  save: "Something went wrong on our side. Your change is kept and will retry.",
  load: "Something went wrong on our side. Try again in a moment.",
  action: "Something went wrong on our side. Try again in a moment.",
  signIn: "Something went wrong on our side. Try signing in again in a moment.",
};

/** API error codes (`error.code` in the body) and what to say for each. */
const BY_CODE: Record<string, string> = {
  session_expired: "You're signed out. Sign in again to sync your changes.",
  unauthorized: "You're signed out. Sign in again to sync your changes.",
  not_found: "That's no longer here. It may have been deleted.",
  conflict: "That clashes with a change made elsewhere. Pull down to refresh.",
  invalid_reference: "Something this links to was deleted. Pick it again.",
  validation_error: "Some details weren't accepted. Check them and try again.",
  invalid_request: "Some details weren't accepted. Check them and try again.",
  ai_disabled: "That AI feature is switched off in Settings › AI.",
  ai_unavailable: "AI isn't set up yet. Use the form instead.",
  ai_cap_reached: "This month's AI limit is used up. It resets on the 1st.",
  ai_error: "AI didn't answer. Use the form instead.",
};

/** Codes whose server message is already written for people ("Pick two different accounts"). */
const HUMAN_MESSAGE = new Set(["bad_request"]);

const UNKNOWN = "Something went wrong. Try again.";
const SIGN_IN_REFUSED = "Google sign-in didn't check out. Try again.";

function field(error: unknown, key: string): unknown {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)[key]
    : undefined;
}

export function friendlyError(error: unknown, context: ErrorContext = "action"): string {
  const name = field(error, "name");
  const code = field(error, "code");
  const status = field(error, "status");
  const message = field(error, "message");
  const fromProxy = field(error, "fromProxy") === true;
  // No answer, or an answer from something that isn't our API (a captive portal).
  if (name === "ServerUnreachableError" || fromProxy) return OFFLINE[context];
  if (typeof code === "string" && typeof status === "number") {
    // At sign-in there is no session to expire: a refusal is Google's check, already in words.
    if (context === "signIn" && code === "unauthorized")
      return typeof message === "string" && message ? message : SIGN_IN_REFUSED;
    if (BY_CODE[code]) return BY_CODE[code];
    if (HUMAN_MESSAGE.has(code) && typeof message === "string" && message) return message;
    if (status >= 500) return SERVER[context];
    if (status === 429) return "Too many tries at once. Wait a moment and try again.";
    if (status === 413) return "That file is too big. Try a smaller photo.";
  }
  return UNKNOWN;
}

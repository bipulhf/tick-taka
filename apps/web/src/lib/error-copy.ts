/**
 * The one place an error becomes words on screen. Raw messages are written for
 * developers ("Request failed (500)", the server's URL, a zod path); people get
 * short, calm copy instead. Pure, so it can be tested.
 */

/**
 * What was going on when it failed:
 * - save: a write (nothing is queued on the web, so it wasn't saved),
 * - load: reading a view's data,
 * - action: anything run once, now (AI, uploads, exports, deleting the account),
 * - signIn: trading Google's sign-in for a session on the sign-in page.
 */
export type ErrorContext = "save" | "load" | "action" | "signIn";

const OFFLINE: Record<ErrorContext, string> = {
  save: "Can't connect right now, so it wasn't saved. Try again once you're back online.",
  load: "Can't connect right now. Check your internet, then try again.",
  action: "Can't connect right now. Check your internet and try again.",
  signIn: "Can't connect right now. Check your internet and try again.",
};

const SERVER: Record<ErrorContext, string> = {
  save: "Something went wrong on our side, so it wasn't saved. Try again in a moment.",
  load: "Something went wrong on our side. Try again in a moment.",
  action: "Something went wrong on our side. Try again in a moment.",
  signIn: "Something went wrong on our side. Try signing in again in a moment.",
};

/** Payload, URL or headers too large. */
const TOO_LARGE_STATUS = new Set([413, 414, 431]);

const TOO_LARGE: Record<ErrorContext, string> = {
  save: "That change is too big to send, so it wasn't saved.",
  load: "That's too much to load at once. Try again.",
  action: "That file is too big. Try a smaller image.",
  signIn: "Something went wrong. Try again.",
};

/** API error codes (`error.code` in the body) and what to say for each. */
const BY_CODE: Record<string, string> = {
  session_expired: "You're signed out. Sign in again to carry on.",
  unauthorized: "You're signed out. Sign in again to carry on.",
  not_found: "That's no longer here. It may have been deleted.",
  conflict: "That clashes with a change made elsewhere. Refresh and try again.",
  invalid_reference: "Something this links to was deleted. Pick it again.",
  validation_error: "Some details weren't accepted. Check them and try again.",
  invalid_request: "Some details weren't accepted. Check them and try again.",
  ai_disabled: "That AI feature is switched off in Settings › Tiki and AI.",
  ai_unavailable: "AI isn't set up yet. Use the form instead.",
  ai_cap_reached: "This month's AI limit is used up. It resets on the 1st.",
  ai_error: "AI didn't answer. Use the form instead.",
  invite_only: "Sign-ups are invite-only right now. Ask for an invite to join.",
  account_blocked: "This account can't be used right now. Contact the owner.",
  forbidden: "That's only for the owner.",
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
  if (typeof status === "number" && TOO_LARGE_STATUS.has(status) && (fromProxy || code))
    return TOO_LARGE[context];
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
  }
  return UNKNOWN;
}

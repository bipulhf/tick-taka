/**
 * When to ask for notification permission, without React Native, so it can be tested.
 * The app asks once per install, the first time a reminder would matter (A-04), and
 * never again after that: if the answer was no, Settings says so and links to the phone's
 * settings instead.
 */

export interface PermissionState {
  granted: boolean;
  /** Android will still show its own prompt. */
  canAskAgain: boolean;
  /** This install has already asked (in this app's own words first). */
  askedBefore: boolean;
}

/** "ask": explain, then show Android's prompt; "skip": don't bother the person. */
export function askDecision(state: PermissionState): "granted" | "ask" | "skip" {
  if (state.granted) return "granted";
  if (state.askedBefore || !state.canAskAgain) return "skip";
  return "ask";
}

/**
 * What Settings shows: "denied" once asked and refused (or Android won't ask again),
 * "unasked" before any reminder has needed it.
 */
export function accessFrom(state: PermissionState): "granted" | "denied" | "unasked" {
  if (state.granted) return "granted";
  return state.askedBefore || !state.canAskAgain ? "denied" : "unasked";
}

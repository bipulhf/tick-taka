import { EARLIEST_PLAUSIBLE_MS } from "@tick-taka/shared/dates";

/**
 * How far the server's clock is ahead of this browser's, learned from the chat's
 * replies (x-server-time). A dropped turn is looked up in server time, so a browser
 * clock that is a few minutes off still finds what Tiki changed.
 */
let offsetMs = 0;

/** The server time a reply carries, or NaN when it carries none (a proxy's own page). */
export function serverTimeOf(headers: { get(name: string): string | null }): number {
  const header = headers.get("x-server-time")?.trim();
  return header ? Number(header) : Number.NaN;
}

/** Learns the offset from a reply, splitting the round trip evenly; nonsense is ignored. */
export function noteServerTime(serverTime: number, sentAt: number, receivedAt: number): void {
  if (!Number.isFinite(serverTime) || serverTime < EARLIEST_PLAUSIBLE_MS) return;
  offsetMs = serverTime - (sentAt + receivedAt) / 2;
}

/** The server's time now, as well as this browser knows it. */
export const serverNow = () => Date.now() + offsetMs;

/**
 * How far the server's clock is ahead of this phone's (ms). Edits are stamped in
 * server time, because the server keeps whichever edit is newest: a phone clock
 * running two minutes slow would otherwise lose every quick follow-up edit, like
 * an Undo.
 */
let offsetMs = 0;

/** Learns the offset from a response's server time, splitting the round trip evenly. */
export function noteServerTime(serverTime: number, sentAt: number, receivedAt: number): void {
  if (!Number.isFinite(serverTime)) return;
  offsetMs = serverTime - (sentAt + receivedAt) / 2;
}

/** Now, in server time: use for every edit's `updatedAt`. */
export function editTime(): number {
  return Math.round(Date.now() + offsetMs);
}

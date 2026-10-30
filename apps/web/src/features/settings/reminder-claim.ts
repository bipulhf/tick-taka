import { claimInLedger } from "./reminder-plan";

const LEDGER_KEY = "tt.reminders-rang";

function claimNow(key: string, keepUntil: number): boolean {
  try {
    const result = claimInLedger(localStorage.getItem(LEDGER_KEY), key, keepUntil, Date.now());
    if (result.claimed) localStorage.setItem(LEDGER_KEY, result.next);
    return result.claimed;
  } catch {
    // No storage to share: ring in this tab rather than not at all.
    return true;
  }
}

/**
 * Whether this tab is the one to ring `key`. Every open tab plans the same reminders;
 * the first to claim one in the shared ledger rings it. A Web Lock per key makes the
 * read and write one step across tabs where the browser has them.
 */
export async function claimReminder(key: string, keepUntil: number): Promise<boolean> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return claimNow(key, keepUntil);
  try {
    return await locks.request(`tt-reminder:${key}`, () => claimNow(key, keepUntil));
  } catch {
    return claimNow(key, keepUntil);
  }
}

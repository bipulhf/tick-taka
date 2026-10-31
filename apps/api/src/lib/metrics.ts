/**
 * Request counts since the process started, for the owner's server-health view:
 * totals by status class, the last 24 hours by hour, and recent response times.
 * In memory only; a restart starts them again (the view says since when).
 */
const HOUR_MS = 3_600_000;
const KEEP_HOURS = 24;
const KEEP_DURATIONS = 2_000;

export const startedAt = Date.now();

interface Bucket {
  hour: number;
  requests: number;
  clientErrors: number;
  serverErrors: number;
}

const totals = { requests: 0, clientErrors: 0, serverErrors: 0 };
const hours: Bucket[] = [];
const durations: number[] = [];
let nextDuration = 0;

/** Called once per finished request by the request log. */
export function recordRequest(status: number, ms: number, at = Date.now()): void {
  const hour = Math.floor(at / HOUR_MS) * HOUR_MS;
  let bucket = hours[hours.length - 1];
  if (!bucket || bucket.hour !== hour) {
    bucket = { hour, requests: 0, clientErrors: 0, serverErrors: 0 };
    hours.push(bucket);
    while (hours.length > KEEP_HOURS) hours.shift();
  }
  for (const target of [totals, bucket]) {
    target.requests += 1;
    if (status >= 500) target.serverErrors += 1;
    else if (status >= 400) target.clientErrors += 1;
  }
  if (durations.length < KEEP_DURATIONS) durations.push(ms);
  else durations[nextDuration] = ms;
  nextDuration = (nextDuration + 1) % KEEP_DURATIONS;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? null;
}

export function requestMetrics(now = Date.now()) {
  const from = now - KEEP_HOURS * HOUR_MS;
  return {
    since: startedAt,
    ...totals,
    lastDay: hours.filter((b) => b.hour >= from),
    medianMs: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
  };
}

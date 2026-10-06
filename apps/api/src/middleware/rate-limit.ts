/** Keys with no attempt inside the window are dropped every this many attempts. */
const PRUNE_EVERY = 100;

/**
 * Fixed-window-free sliding limiter kept in memory. pm2 runs exactly one process,
 * so there is nothing to share across instances.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();
  private attempts = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt. Returns ms to wait when over the limit, otherwise 0. */
  attempt(key: string, now: number): number {
    if (++this.attempts % PRUNE_EVERY === 0) this.prune(now);
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return this.windowMs - (now - recent[0]!);
    }
    recent.push(now);
    this.hits.set(key, recent);
    return 0;
  }

  reset(key: string): void {
    this.hits.delete(key);
  }

  /** How many keys are tracked, for tests. */
  get size(): number {
    return this.hits.size;
  }

  private prune(now: number): void {
    for (const [key, times] of this.hits)
      if (now - times[times.length - 1]! >= this.windowMs) this.hits.delete(key);
  }
}

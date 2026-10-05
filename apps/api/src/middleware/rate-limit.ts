/**
 * Fixed-window-free sliding limiter kept in memory. pm2 runs exactly one process,
 * so there is nothing to share across instances.
 */
export class SlidingWindowLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Records an attempt. Returns ms to wait when over the limit, otherwise 0. */
  attempt(key: string, now: number): number {
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
}

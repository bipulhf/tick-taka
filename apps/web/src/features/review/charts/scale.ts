/**
 * Axis maths for the small SVG charts: clean tick values (0 / 2k / 4k) and the
 * compact labels they wear. Pure.
 */

/** The nearest clean step (1, 2, 2.5 or 5 times a power of ten) at or above `rough`. */
export function niceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * power;
}

export interface Domain {
  min: number;
  max: number;
  ticks: number[];
}

/**
 * About `count` intervals of a clean step covering [min, max]. Columns pass min 0 so
 * they grow from the baseline; a line passes its own lowest value.
 */
export function niceDomain(min: number, max: number, count = 3): Domain {
  let low = Math.min(min, max);
  let high = Math.max(min, max);
  if (low === high) {
    if (high === 0) return { min: 0, max: 1, ticks: [0, 1] };
    low = low > 0 ? 0 : low;
    high = high < 0 ? 0 : high;
  }
  const step = niceStep((high - low) / count);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) ticks.push(round(value));
  return { min: round(start), max: round(end), ticks };
}

const round = (value: number) => Math.round(value * 1e6) / 1e6;

const trim = (value: number) => String(Math.round(value * 10) / 10);

/** 126010 → "126k", 2500 → "2.5k", 1200000 → "1.2M", -40 → "−40". */
export function compactNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`;
  if (abs >= 1000) return `${sign}${trim(abs / 1000)}k`;
  return `${sign}${trim(abs)}`;
}

/** Where `value` sits between `min` and `max`, as 0 to 1. */
export function fraction(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

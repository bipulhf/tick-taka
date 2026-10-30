import { type HTMLAttributes, useEffect, useRef, useState } from "react";
import { formatAmount, numeralsStore } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { cx } from "./cx";

export interface AmountProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  minor: number;
  currency?: string;
  signed?: boolean;
  /** Count up to new values instead of jumping. */
  animate?: boolean;
  /** Colour by sign: mint for money in, coral for money out (with the sign, never alone). */
  tone?: "flow" | "in" | "out";
}

const DURATION_MS = 600;
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Every amount shows the ৳ sign, uses tabular digits and hides in privacy mode. */
export function Amount({
  minor,
  currency,
  signed,
  animate = true,
  tone,
  className,
  ...props
}: AmountProps) {
  const hidden = usePrivacy();
  // Redraw when the numbers setting changes; formatAmount reads it.
  useStore(numeralsStore);
  const [shown, setShown] = useState(minor);
  const from = useRef(minor);

  useEffect(() => {
    if (!animate || reduceMotion() || from.current === minor) {
      from.current = minor;
      setShown(minor);
      return;
    }
    const start = from.current;
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(start + (minor - start) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = minor;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [minor, animate]);

  const color =
    tone === "in" || (tone === "flow" && minor > 0)
      ? "text-mint-text"
      : tone === "out" || (tone === "flow" && minor < 0)
        ? "text-coral-text"
        : undefined;
  const text = hidden
    ? `${formatAmount(0, { currency, numerals: "latn" }).replace(/[\d.,]+/, "")}•••`
    : formatAmount(shown, { currency, signed });
  return (
    <span className={cx("tabular whitespace-nowrap", color, className)} {...props}>
      <span aria-hidden>{text}</span>
      <span className="sr-only">
        {hidden ? "Amount hidden" : formatAmount(minor, { currency, signed })}
      </span>
    </span>
  );
}

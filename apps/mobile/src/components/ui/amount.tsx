import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "react-native-reanimated";
import { formatAmount, numeralsStore } from "@/lib/format";
import { usePrivacy } from "@/lib/privacy";
import { useStore } from "@/lib/store";
import { Text, type TextProps } from "./text";

export interface AmountProps extends Omit<TextProps, "children"> {
  minor: number;
  currency?: string;
  signed?: boolean;
  /** Count up to new values instead of jumping. */
  animate?: boolean;
}

const DURATION_MS = 600;

/** Every amount shows the ৳ sign, uses tabular digits and hides in privacy mode. */
export function Amount({ minor, currency, signed, animate = true, ...props }: AmountProps) {
  const hidden = usePrivacy();
  // Redraw when the numbers setting changes; formatAmount reads it.
  useStore(numeralsStore);
  const reduceMotion = useReducedMotion();
  const [shown, setShown] = useState(minor);
  const from = useRef(minor);

  useEffect(() => {
    if (!animate || reduceMotion || from.current === minor) {
      from.current = minor;
      setShown(minor);
      return;
    }
    const start = from.current;
    const began = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - began) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      setShown(Math.round(start + (minor - start) * eased));
      if (t < 1) frame = requestAnimationFrame(step);
      else from.current = minor;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [minor, animate, reduceMotion]);

  const text = hidden
    ? `${formatAmount(0, { currency, numerals: "latn" }).replace(/[\d.,]+/, "")}•••`
    : formatAmount(shown, { currency, signed });
  return (
    <Text
      numeric
      accessibilityLabel={hidden ? "Amount hidden" : formatAmount(minor, { currency, signed })}
      {...props}
    >
      {text}
    </Text>
  );
}

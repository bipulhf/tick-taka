import { Text as RNText, type TextProps as RNTextProps } from "react-native";

/** Type scale from DESIGN.md: large and calm, hierarchy from size and weight. */
const VARIANTS = {
  hero: "font-nunito-black text-[44px] leading-[50px]",
  largeTitle: "font-nunito-black text-[34px] leading-[40px]",
  display: "font-nunito-black text-[34px] leading-[40px]",
  title: "font-nunito-black text-2xl leading-[30px]",
  heading: "font-nunito-bold text-xl leading-[26px]",
  body: "font-nunito text-[17px] leading-6",
  strong: "font-nunito-bold text-[17px] leading-6",
  callout: "font-nunito text-[15px] leading-[21px]",
  caption: "font-nunito-semibold text-[13px] leading-[18px]",
  label: "font-nunito-semibold text-[13px] leading-[18px]",
} as const;

/** Semantic tones use the "-text" tier, which reaches WCAG AA on background and cards. */
const TONES = {
  ink: "text-ink",
  muted: "text-muted",
  sky: "text-sky-text",
  mint: "text-mint-text",
  coral: "text-coral-text",
  grape: "text-grape-text",
  mango: "text-mango-text",
  /** On mango and every other semantic fill (sky, mint, coral, grape): always dark. */
  onAccent: "text-on-mango",
  /** For text on an ink-coloured surface; flips with the theme. */
  background: "text-background",
  /** Mango action text on an ink-coloured surface (snackbar Undo). */
  mangoOnInk: "text-mango-inverse",
} as const;

/**
 * Font scaling stays on everywhere so text grows with the system setting; only the
 * 44 px hero number is capped, since at 2x it would no longer fit one line on a phone.
 */
const MAX_SCALE: Partial<Record<keyof typeof VARIANTS, number>> = { hero: 1.3 };

export type TextVariant = keyof typeof VARIANTS;
export type TextTone = keyof typeof TONES;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Tabular digits so amounts and timers don't jiggle while they change. */
  numeric?: boolean;
  className?: string;
}

export function Text({
  variant = "body",
  tone = "ink",
  numeric,
  className,
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={MAX_SCALE[variant]}
      className={`${VARIANTS[variant]} ${TONES[tone]} ${className ?? ""}`}
      style={[numeric ? { fontVariant: ["tabular-nums"] } : null, style]}
      {...props}
    />
  );
}

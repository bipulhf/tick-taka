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

const TONES = {
  ink: "text-ink",
  muted: "text-muted",
  sky: "text-sky",
  mint: "text-mint",
  coral: "text-coral",
  grape: "text-grape",
  mango: "text-mango",
  /** On mango or other light accent fills: always dark. */
  onAccent: "text-on-mango",
  inverse: "text-white",
  /** For text on an ink-coloured surface; flips with the theme. */
  background: "text-background",
} as const;

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
      className={`${VARIANTS[variant]} ${TONES[tone]} ${className ?? ""}`}
      style={[numeric ? { fontVariant: ["tabular-nums"] } : null, style]}
      {...props}
    />
  );
}

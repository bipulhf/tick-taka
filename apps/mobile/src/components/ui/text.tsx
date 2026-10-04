import { Text as RNText, type TextProps as RNTextProps } from "react-native";

const VARIANTS = {
  display: "font-nunito-black text-4xl",
  title: "font-nunito-black text-2xl",
  heading: "font-nunito-bold text-lg",
  body: "font-nunito text-base",
  strong: "font-nunito-bold text-base",
  caption: "font-nunito text-sm",
  label: "font-nunito-semibold text-xs uppercase tracking-wider",
} as const;

const TONES = {
  ink: "text-ink",
  muted: "text-muted",
  sky: "text-sky",
  mint: "text-mint",
  coral: "text-coral",
  grape: "text-grape",
  mango: "text-mango",
  inverse: "text-white",
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

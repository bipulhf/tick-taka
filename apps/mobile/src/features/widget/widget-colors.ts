import { palette } from "@/theme/palette";

/** The widget library only takes hex colours. */
type Hex = `#${string}`;

/** An opaque colour for `fill` at `alpha` laid over `base` (the widget can't blend). */
export function blend(fill: string, base: string, alpha: number): Hex {
  const channel = (hex: string, i: number) => Number.parseInt(hex.slice(i, i + 2), 16);
  return `#${[1, 3, 5]
    .map((i) =>
      Math.round(channel(fill, i) * alpha + channel(base, i) * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase() as Hex;
}

/**
 * The widget's colours, built from the app's tested tokens so they can't drift:
 * words use the "-text" tier, bright tokens only draw marks (the spend bar).
 * test/contrast.test.ts checks every text pair here.
 */
export function widgetColors(scheme: "light" | "dark") {
  const p = palette[scheme];
  const hex = (value: string) => value as Hex;
  return {
    /** Background gradient: warm paper in light, charcoal in dark. */
    from: scheme === "light" ? hex(p.background) : hex(p.card),
    to: scheme === "light" ? blend(p.mango, p.background, 0.12) : hex(p.background),
    card: scheme === "light" ? hex(p.card) : blend(p.ink, p.card, 0.04),
    ink: hex(p.ink),
    muted: hex(p.muted),
    track: hex(p.line),
    /** Marks only. */
    mint: hex(p.mint),
    coral: hex(p.coral),
    mintText: hex(p.mintText),
    coralText: hex(p.coralText),
    skyText: hex(p.skyText),
    skyTint: blend(p.sky, p.card, 0.15),
    coralTint: blend(p.coral, p.card, 0.15),
  };
}

export type WidgetColors = ReturnType<typeof widgetColors>;

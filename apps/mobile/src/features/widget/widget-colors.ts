import { ON_ACCENT, palette } from "@/theme/palette";

/** The widget library only takes hex colours: #RRGGBB, or #RRGGBBAA for see-through. */
export type Hex = `#${string}`;

/** A widget's look, picked per widget when it is added (or reconfigured). */
export type Look = "auto" | "paper" | "night" | "glass" | "mango";
/** A look as drawn: Auto is Paper in light mode and Night in dark mode. */
export type Face = Exclude<Look, "auto">;

export const LOOKS: { look: Look; name: string; hint: string }[] = [
  { look: "auto", name: "Auto", hint: "Paper by day, Night in dark mode" },
  { look: "paper", name: "Paper", hint: "Warm and light" },
  { look: "night", name: "Night", hint: "Warm charcoal" },
  { look: "glass", name: "Glass", hint: "See-through, over your wallpaper" },
  { look: "mango", name: "Mango", hint: "Bold and bright" },
];

export function isLook(value: unknown): value is Look {
  return LOOKS.some((option) => option.look === value);
}

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

/** What a colour looks like over `base`: itself if opaque, else blended by its alpha. */
export function flatten(color: string, base: string): Hex {
  if (color.length !== 9) return color.toUpperCase() as Hex;
  return blend(color.slice(0, 7), base, Number.parseInt(color.slice(7), 16) / 255);
}

/**
 * Every colour a widget draws with, per look. Words use a tone that reaches 4.5:1 on
 * the widget and its cards; bright marks only fill bars and dots beside a label, and
 * marks that are the only cue (a task's circle, a habit's arc) reach 3:1.
 * test/contrast.test.ts checks every pair, for Glass over both a white and a black
 * wallpaper.
 */
export interface LookColors {
  /** Background, top-left to bottom-right; the same colour twice for a flat look. */
  from: Hex;
  to: Hex;
  /** A hairline round the widget (Glass), else null. */
  edge: Hex | null;
  /** Rows, chips and the Next card. */
  card: Hex;
  ink: Hex;
  muted: Hex;
  /** Bar and ring tracks. */
  track: Hex;
  /** Words for money in, money out, time and habits. */
  inText: Hex;
  outText: Hex;
  timeText: Hex;
  habitText: Hex;
  /** Bright marks beside a label: bar fills and dots. */
  inMark: Hex;
  outMark: Hex;
  timeMark: Hex;
  /** Sole-cue marks: a task's circle and a habit's arc. */
  check: Hex;
  habitArc: Hex;
  /** The main button (＋ Task, − Expense) and the others. */
  primary: Hex;
  onPrimary: Hex;
  secondary: Hex;
  onSecondary: Hex;
  secondaryEdge: Hex;
  /** The Undo strip, drawn inverted like the app's snackbar. */
  strip: Hex;
  onStrip: Hex;
  stripAction: Hex;
}

function paper(): LookColors {
  const p = palette.light;
  const hex = (value: string) => value as Hex;
  return {
    from: hex(p.background),
    to: blend(p.mango, p.background, 0.12),
    edge: null,
    card: hex(p.card),
    ink: hex(p.ink),
    muted: hex(p.muted),
    track: hex(p.line),
    inText: hex(p.mintText),
    outText: hex(p.coralText),
    timeText: hex(p.skyText),
    habitText: hex(p.grapeText),
    inMark: hex(p.mint),
    outMark: hex(p.coral),
    timeMark: hex(p.sky),
    check: hex(p.skyText),
    habitArc: hex(p.grapeText),
    primary: hex(p.mango),
    onPrimary: hex(ON_ACCENT),
    secondary: hex(p.card),
    onSecondary: hex(p.ink),
    secondaryEdge: hex(p.lineStrong),
    strip: hex(p.ink),
    onStrip: hex(p.background),
    stripAction: hex(p.mangoInverse),
  };
}

function night(): LookColors {
  const p = palette.dark;
  const hex = (value: string) => value as Hex;
  const card = blend(p.ink, p.card, 0.04);
  return {
    from: hex(p.card),
    to: hex(p.background),
    edge: null,
    card,
    ink: hex(p.ink),
    muted: hex(p.muted),
    track: hex(p.line),
    inText: hex(p.mintText),
    outText: hex(p.coralText),
    timeText: hex(p.skyText),
    habitText: hex(p.grapeText),
    inMark: hex(p.mint),
    outMark: hex(p.coral),
    timeMark: hex(p.sky),
    check: hex(p.skyText),
    habitArc: hex(p.grapeText),
    primary: hex(p.mango),
    onPrimary: hex(ON_ACCENT),
    secondary: card,
    onSecondary: hex(p.ink),
    secondaryEdge: hex(p.lineStrong),
    strip: hex(p.ink),
    onStrip: hex(p.background),
    stripAction: hex(p.mangoInverse),
  };
}

/**
 * See-through, with a charcoal scrim (69%) under everything, so white words keep
 * 4.5:1 over any wallpaper, a white one included. Cards darken a little more
 * instead of lightening, and the tones are pale tints of the dark-theme tokens.
 */
function glass(): LookColors {
  const p = palette.dark;
  const light = palette.light;
  const white = "#FFFFFF";
  const tint = (token: string) => blend(white, token, 0.7);
  const scrim = `${p.background}B0` as Hex;
  return {
    from: scrim,
    to: scrim,
    edge: "#FFFFFF59",
    card: "#00000024",
    ink: white,
    muted: blend(white, p.muted, 0.8),
    track: "#FFFFFF4D",
    inText: tint(p.mint),
    outText: tint(p.coral),
    timeText: tint(p.sky),
    habitText: tint(p.grape),
    inMark: p.mint as Hex,
    outMark: p.coral as Hex,
    timeMark: p.sky as Hex,
    check: white,
    habitArc: tint(p.grape),
    primary: light.background as Hex,
    onPrimary: light.ink as Hex,
    secondary: "#00000024",
    onSecondary: white,
    secondaryEdge: "#FFFFFF8C",
    strip: light.ink as Hex,
    onStrip: light.background as Hex,
    stripAction: light.mangoInverse as Hex,
  };
}

/** Bold: the mango accent as the whole background, ink everywhere on it. */
function mango(): LookColors {
  const p = palette.light;
  const ink = p.ink;
  const deep = (token: string) => blend(token, ink, 0.65);
  const card = blend("#FFFFFF", p.mango, 0.55);
  return {
    from: p.mango as Hex,
    to: p.mango as Hex,
    edge: null,
    card,
    ink: ink as Hex,
    muted: blend(ink, p.mango, 0.75),
    track: blend(ink, p.mango, 0.18),
    inText: deep(p.mintText),
    outText: deep(p.coralText),
    timeText: deep(p.skyText),
    habitText: deep(p.grapeText),
    inMark: deep(p.mintText),
    outMark: deep(p.coralText),
    timeMark: deep(p.skyText),
    check: ink as Hex,
    habitArc: deep(p.grapeText),
    primary: ink as Hex,
    onPrimary: p.mango as Hex,
    secondary: card,
    onSecondary: ink as Hex,
    secondaryEdge: blend(ink, p.mango, 0.6),
    strip: ink as Hex,
    onStrip: p.background as Hex,
    stripAction: p.mango as Hex,
  };
}

const FACES: Record<Face, () => LookColors> = { paper, night, glass, mango };

/** A look's colours. Pure, so the contrast test checks exactly what is drawn. */
export function lookColors(face: Face): LookColors {
  return FACES[face]();
}

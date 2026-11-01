// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { WidgetUndo } from "../widget-cache";
import type { Hex, LookColors } from "../widget-colors";
import { PADDING } from "../widget-layout";
import { undoText } from "../widget-optimistic";

/** Caption size: the smallest text, as in the app. */
export const CAPTION = 13;
export const RADIUS = 22;

/** Tiki's coin face, small enough for a widget corner. */
export const TIKI = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<circle cx="60" cy="60" r="56" fill="#E8962A"/><circle cx="60" cy="60" r="48" fill="#FFB547"/>
<circle cx="60" cy="60" r="40" fill="#FFD48F"/>
<line x1="60" y1="24" x2="60" y2="36" stroke="#E8962A" stroke-width="5" stroke-linecap="round"/>
<circle cx="47" cy="58" r="5.5" fill="#3A2A1A"/><circle cx="73" cy="58" r="5.5" fill="#3A2A1A"/>
<path d="M45 71 Q60 84 75 71" stroke="#3A2A1A" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

/** Opens a screen of the app. */
export function open(uri: string) {
  return { clickAction: "OPEN_URI", clickActionData: { uri } };
}

/** The widget's surface in its look; tapping an empty part opens `uri` (or the app). */
export function Shell({
  c,
  children,
  uri,
  label,
  padding = PADDING,
  direction = "column",
}: {
  c: LookColors;
  children: unknown;
  uri?: string;
  label?: string;
  padding?: number;
  direction?: "row" | "column";
}) {
  return (
    <FlexWidget
      {...(uri ? open(uri) : { clickAction: "OPEN_APP" })}
      accessibilityLabel={label}
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundGradient: { from: c.from, to: c.to, orientation: "TL_BR" },
        ...(c.edge ? { borderWidth: 1, borderColor: c.edge } : {}),
        borderRadius: RADIUS,
        padding,
        flexDirection: direction,
        flexGap: 6,
      }}
    >
      {children}
    </FlexWidget>
  );
}

export function Words({
  text,
  color,
  size = CAPTION,
  bold = false,
  lines = 1,
  align,
}: {
  text: string;
  color: Hex;
  size?: number;
  bold?: boolean;
  lines?: number;
  align?: "left" | "center" | "right";
}) {
  return (
    <TextWidget
      text={text}
      maxLines={lines}
      truncate="END"
      style={{
        fontSize: size,
        fontWeight: bold ? "bold" : "normal",
        color,
        ...(align ? { textAlign: align } : {}),
      }}
    />
  );
}

/** A label on the left and another on the right, on one line. */
export function Spread({ left, right }: { left: unknown; right?: unknown }) {
  return (
    <FlexWidget
      style={{
        flexDirection: "row",
        width: "match_parent",
        alignItems: "center",
        justifyContent: "space-between",
        flexGap: 8,
      }}
    >
      <FlexWidget style={{ flex: 1 }}>{left}</FlexWidget>
      {right ?? null}
    </FlexWidget>
  );
}

export type PillTone = "primary" | "secondary";

/** A button: the main one (mango) or a plain one, at least 48 dp tall unless `height` says. */
export function Pill({
  label,
  c,
  tone = "secondary",
  clickAction,
  clickActionData,
  accessibilityLabel,
  flex,
  height = 48,
  padding = 12,
}: {
  label: string;
  c: LookColors;
  tone?: PillTone;
  clickAction: string;
  clickActionData?: Record<string, unknown>;
  accessibilityLabel: string;
  flex?: number;
  height?: number;
  padding?: number;
}) {
  const primary = tone === "primary";
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      accessibilityLabel={accessibilityLabel}
      style={{
        ...(flex ? { flex } : {}),
        paddingHorizontal: padding,
        height,
        borderRadius: height / 2,
        backgroundColor: primary ? c.primary : c.secondary,
        ...(primary ? {} : { borderWidth: 1, borderColor: c.secondaryEdge }),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget
        text={label}
        maxLines={1}
        truncate="END"
        style={{
          fontSize: CAPTION,
          fontWeight: "bold",
          color: primary ? c.onPrimary : c.onSecondary,
        }}
      />
    </FlexWidget>
  );
}

/** A horizontal progress bar; `value` from 0 to 1. */
export function Bar({ value, tone, c }: { value: number; tone: Hex; c: LookColors }) {
  const filled = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <FlexWidget
      style={{
        flexDirection: "row",
        width: "match_parent",
        height: 6,
        borderRadius: 3,
        backgroundColor: c.track,
        overflow: "hidden",
      }}
    >
      {filled > 0 ? (
        <FlexWidget
          style={{ flex: filled, height: "match_parent", borderRadius: 3, backgroundColor: tone }}
        />
      ) : null}
      {filled < 100 ? <FlexWidget style={{ flex: 100 - filled, height: "match_parent" }} /> : null}
    </FlexWidget>
  );
}

/** A task's circle: an outline to tick, or filled with a tick once done. */
export function Check({ done, c }: { done: boolean; c: LookColors }) {
  return (
    <FlexWidget
      style={{
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: c.check,
        backgroundColor: done ? c.check : "#00000000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {done ? (
        <TextWidget
          text="✓"
          style={{ fontSize: CAPTION, fontWeight: "bold", color: c.from.slice(0, 7) as Hex }}
        />
      ) : null}
    </FlexWidget>
  );
}

/** A ring's SVG: a track and an arc for `share` (0 to 1), solid once full. Pure. */
export function ringSvg(input: {
  size: number;
  stroke: number;
  share: number;
  track: string;
  arc: string;
}): string {
  const { size, stroke, track, arc } = input;
  const share = Math.min(1, Math.max(0, input.share));
  const r = (size - stroke) / 2;
  const mid = size / 2;
  const length = 2 * Math.PI * r;
  const solid = share >= 1;
  const color = (hex: string) => hex.slice(0, 7);
  const opacity = (hex: string) =>
    hex.length === 9
      ? ` stroke-opacity="${(Number.parseInt(hex.slice(7), 16) / 255).toFixed(2)}"`
      : "";
  const base = `<circle cx="${mid}" cy="${mid}" r="${r}" fill="${solid ? color(arc) : "none"}"${
    solid ? ` fill-opacity="0.25"` : ""
  } stroke="${color(solid ? arc : track)}"${solid ? "" : opacity(track)} stroke-width="${stroke}"/>`;
  const part =
    share > 0 && !solid
      ? `<circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${color(arc)}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${(length * share).toFixed(1)} ${length.toFixed(1)}" transform="rotate(-90 ${mid} ${mid})"/>`
      : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${base}${part}</svg>`;
}

/** A ring with an emoji in the middle (habits, focus). */
export function Ring({
  size,
  share,
  track,
  arc,
  emoji,
}: {
  size: number;
  share: number;
  track: string;
  arc: string;
  emoji: string;
}) {
  return (
    <OverlapWidget style={{ width: size, height: size }}>
      <SvgWidget
        svg={ringSvg({ size, stroke: 5, share, track, arc })}
        style={{ width: size, height: size }}
      />
      <FlexWidget
        style={{
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TextWidget text={emoji} style={{ fontSize: Math.round(size * 0.36), color: "#000000" }} />
      </FlexWidget>
    </OverlapWidget>
  );
}

/** "Cha ৳20 logged · Undo", inverted like the app's snackbar; shown for a few seconds. */
export function UndoStrip({ undo, c }: { undo: WidgetUndo; c: LookColors }) {
  return (
    <FlexWidget
      clickAction="UNDO"
      accessibilityLabel={`Undo: ${undo.text}`}
      style={{
        flexDirection: "row",
        width: "match_parent",
        height: 48,
        borderRadius: 14,
        backgroundColor: c.strip,
        paddingHorizontal: 12,
        alignItems: "center",
        flexGap: 8,
      }}
    >
      <FlexWidget style={{ flex: 1 }}>
        <Words text={undoText(undo)} color={c.onStrip} />
      </FlexWidget>
      <Words text="Undo" color={c.stripAction} bold />
    </FlexWidget>
  );
}

/** A one-line note the widget leaves after a tap it couldn't do ("Too late to undo here"). */
export function Status({ text, c }: { text: string; c: LookColors }) {
  return <Words text={text} color={c.muted} lines={2} />;
}

/** Signed out: nothing of anyone's day, and a tap opens sign-in. */
export function SignedOut({ c, small }: { c: LookColors; small: boolean }) {
  return (
    <Shell c={c} uri="ticktaka://login" label="Sign in to Tick & Taka" padding={14}>
      <FlexWidget
        style={{
          flex: 1,
          width: "match_parent",
          flexDirection: small ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          flexGap: small ? 6 : 14,
        }}
      >
        <SvgWidget svg={TIKI} style={{ width: small ? 36 : 48, height: small ? 36 : 48 }} />
        <FlexWidget style={{ flexDirection: "column", flexGap: 2 }}>
          <Words text="Tick & Taka" color={c.ink} size={small ? 15 : 17} bold />
          <Words text="Tap to sign in" color={c.muted} lines={2} />
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

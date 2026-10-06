// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { formatAmount } from "@tick-taka/shared/money";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { WidgetCache } from "./widget-cache";

const COLORS = {
  light: {
    from: "#FFF8EE",
    to: "#FFEFD9",
    card: "#FFFFFF",
    ink: "#23202B",
    muted: "#7D7670",
    track: "#EEE5D8",
    mint: "#1E9E80",
    coral: "#E8604F",
    sky: "#3F6FE0",
    skyTint: "#E3EBFF",
    coralTint: "#FFE6E2",
    grapeTint: "#EFE6FF",
    grape: "#7B4FE0",
    mangoTint: "#FFEBC8",
    mango: "#8A5A00",
  },
  dark: {
    from: "#22202B",
    to: "#16151C",
    card: "#2B2935",
    ink: "#F4F1EA",
    muted: "#A09AA6",
    track: "#34313F",
    mint: "#4FD8B5",
    coral: "#FF9385",
    sky: "#7AA2FF",
    skyTint: "#28304A",
    coralTint: "#3D2A2D",
    grapeTint: "#33294A",
    grape: "#B996FF",
    mangoTint: "#3D3222",
    mango: "#FFC266",
  },
} as const;
type Palette = (typeof COLORS)["light" | "dark"];
/** The widget library only takes hex colours. */
type Hex = `#${string}`;

/** Tiki's coin face, small enough for a widget corner. */
const TIKI = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<circle cx="60" cy="60" r="56" fill="#E8962A"/><circle cx="60" cy="60" r="48" fill="#FFB547"/>
<circle cx="60" cy="60" r="40" fill="#FFD48F"/>
<line x1="60" y1="24" x2="60" y2="36" stroke="#E8962A" stroke-width="5" stroke-linecap="round"/>
<circle cx="47" cy="58" r="5.5" fill="#3A2A1A"/><circle cx="73" cy="58" r="5.5" fill="#3A2A1A"/>
<path d="M45 71 Q60 84 75 71" stroke="#3A2A1A" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

/** Below this height (dp) the quick-log chips don't fit. */
const TALL = 170;

function Bar({ value, tone, c }: { value: number; tone: Hex; c: Palette }) {
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

function Action({ label, uri, tint, tone }: { label: string; uri: string; tint: Hex; tone: Hex }) {
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri }}
      style={{
        flex: 1,
        height: 36,
        borderRadius: 18,
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget
        text={label}
        maxLines={1}
        style={{ fontSize: 12, fontWeight: "bold", color: tone }}
      />
    </FlexWidget>
  );
}

function SignedOut({ c }: { c: Palette }) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundGradient: { from: c.from, to: c.to, orientation: "TL_BR" },
        borderRadius: 24,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        flexGap: 14,
      }}
    >
      <SvgWidget svg={TIKI} style={{ width: 48, height: 48 }} />
      <FlexWidget style={{ flex: 1, flexDirection: "column", flexGap: 2 }}>
        <TextWidget text="Tick & Taka" style={{ fontSize: 16, fontWeight: "bold", color: c.ink }} />
        <TextWidget
          text="Sign in to see your day and what's safe to spend."
          maxLines={2}
          style={{ fontSize: 12, color: c.muted }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Home-screen widget: today at a glance. What's safe to spend (and how much of
 * today's share is gone), what to do next, top-three and habit progress, and
 * one-tap buttons to add a task, log an expense, start focusing or talk to Tiki.
 */
export function SafeToSpendWidget({
  cache,
  scheme,
  height = 0,
}: {
  cache: WidgetCache;
  scheme: "light" | "dark";
  height?: number;
}) {
  const c = COLORS[scheme];
  if (!cache.signedIn) return <SignedOut c={c} />;

  const left = cache.leftTodayMinor;
  const over = left !== null && left < 0;
  const spentShare = cache.dailyMinor > 0 ? cache.spentTodayMinor / cache.dailyMinor : 0;
  const progress = [
    cache.topThree.total ? `Top three ${cache.topThree.done}/${cache.topThree.total}` : null,
    cache.habits.total ? `Habits ${cache.habits.done}/${cache.habits.total}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const showQuick = height >= TALL && cache.quick.length > 0;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundGradient: { from: c.from, to: c.to, orientation: "TL_BR" },
        borderRadius: 24,
        padding: 12,
        flexDirection: "column",
        flexGap: 10,
      }}
    >
      <FlexWidget style={{ flex: 1, flexDirection: "row", width: "match_parent", flexGap: 10 }}>
        <FlexWidget
          style={{
            flex: 1,
            height: "match_parent",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingHorizontal: 4,
          }}
        >
          <TextWidget
            text={over ? "Over today's amount by" : "Safe to spend today"}
            style={{ fontSize: 11, color: c.muted }}
          />
          <TextWidget
            text={left === null ? "Set a budget" : formatAmount(Math.abs(left))}
            maxLines={1}
            style={{
              fontSize: left === null ? 18 : 26,
              fontWeight: "bold",
              color: over ? c.coral : c.mint,
            }}
          />
          {left === null ? null : (
            <Bar value={over ? 1 : spentShare} tone={over ? c.coral : c.mint} c={c} />
          )}
          <TextWidget
            text={
              cache.status ??
              (left === null
                ? "Budgets give you a daily number"
                : `${formatAmount(cache.spentTodayMinor)} of ${formatAmount(cache.dailyMinor)} spent`)
            }
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, color: c.muted }}
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "ticktaka://" }}
          style={{
            flex: 1,
            height: "match_parent",
            backgroundColor: c.card,
            borderRadius: 16,
            padding: 10,
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
            <SvgWidget svg={TIKI} style={{ width: 18, height: 18 }} />
            <TextWidget text="Next up" style={{ fontSize: 11, color: c.muted }} />
          </FlexWidget>
          <TextWidget
            text={cache.nextUp?.title ?? "All clear for today"}
            maxLines={2}
            truncate="END"
            style={{ fontSize: 14, fontWeight: "bold", color: c.ink }}
          />
          <TextWidget
            text={cache.nextUp ? cache.nextUp.when : "Nice work ✨"}
            maxLines={1}
            style={{ fontSize: 11, fontWeight: "bold", color: c.sky }}
          />
          {progress ? (
            <TextWidget
              text={progress}
              maxLines={1}
              truncate="END"
              style={{ fontSize: 10, color: c.muted }}
            />
          ) : null}
        </FlexWidget>
      </FlexWidget>
      {showQuick ? (
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
          {cache.quick.map((entry, index) => (
            <FlexWidget
              key={`${entry.note}-${entry.amountMinor}`}
              clickAction="LOG"
              clickActionData={{ index }}
              style={{
                backgroundColor: c.card,
                borderRadius: 14,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <TextWidget
                text={`${entry.label} ${formatAmount(entry.amountMinor)}`}
                maxLines={1}
                style={{ fontSize: 12, color: c.ink }}
              />
            </FlexWidget>
          ))}
        </FlexWidget>
      ) : null}
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
        <Action label="＋ Task" uri="ticktaka://add?kind=task" tint={c.skyTint} tone={c.sky} />
        <Action
          label="－ Expense"
          uri="ticktaka://add?kind=expense"
          tint={c.coralTint}
          tone={c.coral}
        />
        <Action label="▶ Focus" uri="ticktaka://focus" tint={c.skyTint} tone={c.sky} />
        <Action
          label="🎙 Tiki"
          uri="ticktaka://assistant?start=talk"
          tint={c.mangoTint}
          tone={c.mango}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

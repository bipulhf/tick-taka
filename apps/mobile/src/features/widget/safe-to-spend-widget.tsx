// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { formatAmount as formatAmountIn } from "@tick-taka/shared/money";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { WidgetCache } from "./widget-cache";
import { type WidgetColors, widgetColors } from "./widget-colors";
import { canUndo, lastLogText } from "./widget-quick-log";

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

/** Every tappable part of the widget is at least this tall (dp). */
const TARGET = 48;
/** Caption size: the smallest text, as in the app. */
const CAPTION = 13;
/** Below this height (dp) only the numbers and the buttons fit. */
const COMPACT = 160;
/** At or above this height (dp) there's room for the quick-log row. */
const TALL = 240;

function Bar({ value, tone, c }: { value: number; tone: Hex; c: WidgetColors }) {
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

function Pill({
  label,
  tint,
  tone,
  clickAction,
  clickActionData,
  accessibilityLabel,
  flex,
}: {
  label: string;
  tint: Hex;
  tone: Hex;
  clickAction: string;
  clickActionData?: Record<string, unknown>;
  accessibilityLabel: string;
  flex?: number;
}) {
  return (
    <FlexWidget
      clickAction={clickAction}
      clickActionData={clickActionData}
      accessibilityLabel={accessibilityLabel}
      style={{
        ...(flex ? { flex } : { paddingHorizontal: 14 }),
        height: TARGET,
        borderRadius: TARGET / 2,
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <TextWidget
        text={label}
        maxLines={1}
        style={{ fontSize: CAPTION, fontWeight: "bold", color: tone }}
      />
    </FlexWidget>
  );
}

function SignedOut({ c }: { c: WidgetColors }) {
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
        <TextWidget text="Tick & Taka" style={{ fontSize: 17, fontWeight: "bold", color: c.ink }} />
        <TextWidget
          text="Sign in to see your day and what's safe to spend."
          maxLines={2}
          style={{ fontSize: CAPTION, color: c.muted }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Home-screen widget: today at a glance. What's safe to spend (and how much of
 * today's share is gone), what to do next, top-three and habit progress, and
 * one-tap buttons to add a task, log an expense, start focusing or talk to Tiki.
 * A quick-log can be taken back from the widget for a few minutes.
 */
export function SafeToSpendWidget({
  cache,
  scheme,
  height = 0,
  now = Date.now(),
}: {
  cache: WidgetCache;
  scheme: "light" | "dark";
  height?: number;
  now?: number;
}) {
  const c = widgetColors(scheme);
  if (!cache.signedIn) return <SignedOut c={c} />;

  const money = (minor: number) => formatAmountIn(minor, { numerals: cache.numerals });
  const left = cache.leftTodayMinor;
  const over = left !== null && left < 0;
  const spentShare = cache.dailyMinor > 0 ? cache.spentTodayMinor / cache.dailyMinor : 0;
  const progress = [
    cache.topThree.total ? `Top three ${cache.topThree.done}/${cache.topThree.total}` : null,
    cache.habits.total ? `Habits ${cache.habits.done}/${cache.habits.total}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const compact = height > 0 && height < COMPACT;
  const tall = height >= TALL;
  const undo = canUndo(cache, now) && cache.lastLog ? cache.lastLog : null;
  const showQuick = tall && !undo && cache.quick.length > 0;
  const statusLine =
    cache.status ??
    (undo && !tall
      ? lastLogText(undo, money(undo.amountMinor))
      : left === null
        ? "Budgets give you a daily number"
        : `${money(cache.spentTodayMinor)} of ${money(cache.dailyMinor)} spent`);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundGradient: { from: c.from, to: c.to, orientation: "TL_BR" },
        borderRadius: 24,
        padding: compact ? 10 : 12,
        flexDirection: "column",
        flexGap: 8,
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
            maxLines={1}
            style={{ fontSize: CAPTION, color: c.muted }}
          />
          <TextWidget
            text={left === null ? "Set a budget" : money(Math.abs(left))}
            maxLines={1}
            style={{
              fontSize: left === null ? 20 : 26,
              fontWeight: "bold",
              color: over ? c.coralText : c.mintText,
            }}
          />
          {left === null || compact ? null : (
            <Bar value={over ? 1 : spentShare} tone={over ? c.coral : c.mint} c={c} />
          )}
          {compact ? null : (
            <TextWidget
              text={statusLine}
              maxLines={1}
              truncate="END"
              style={{ fontSize: CAPTION, color: c.muted }}
            />
          )}
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
          {compact ? null : (
            <FlexWidget style={{ flexDirection: "row", alignItems: "center", flexGap: 6 }}>
              <SvgWidget svg={TIKI} style={{ width: 18, height: 18 }} />
              <TextWidget text="Next up" style={{ fontSize: CAPTION, color: c.muted }} />
            </FlexWidget>
          )}
          <TextWidget
            text={cache.nextUp?.title ?? "All clear for today"}
            maxLines={compact ? 1 : 2}
            truncate="END"
            style={{ fontSize: 15, fontWeight: "bold", color: c.ink }}
          />
          <TextWidget
            text={cache.nextUp ? cache.nextUp.when : "Nice work ✨"}
            maxLines={1}
            style={{ fontSize: CAPTION, fontWeight: "bold", color: c.skyText }}
          />
          {progress && !compact ? (
            <TextWidget
              text={progress}
              maxLines={1}
              truncate="END"
              style={{ fontSize: CAPTION, color: c.muted }}
            />
          ) : null}
        </FlexWidget>
      </FlexWidget>
      {tall && undo ? (
        <FlexWidget
          style={{ flexDirection: "row", width: "match_parent", alignItems: "center", flexGap: 6 }}
        >
          <FlexWidget style={{ flex: 1, paddingHorizontal: 4 }}>
            <TextWidget
              text={lastLogText(undo, money(undo.amountMinor))}
              maxLines={1}
              truncate="END"
              style={{ fontSize: CAPTION, color: c.ink }}
            />
          </FlexWidget>
          <Pill
            label="Undo"
            tint={c.card}
            tone={c.ink}
            clickAction="UNDO_LOG"
            accessibilityLabel={`Undo: remove ${undo.label} ${money(undo.amountMinor)}`}
          />
          <Pill
            label="Keep"
            tint={c.card}
            tone={c.muted}
            clickAction="KEEP_LOG"
            accessibilityLabel="Keep it and show the quick-log buttons"
          />
        </FlexWidget>
      ) : null}
      {showQuick ? (
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
          {cache.quick.map((entry, index) => (
            <Pill
              key={`${entry.note}-${entry.amountMinor}`}
              label={`${entry.label} ${money(entry.amountMinor)}`}
              tint={c.card}
              tone={c.ink}
              clickAction="LOG"
              clickActionData={{ index }}
              accessibilityLabel={`Log ${entry.label}, ${money(entry.amountMinor)}, as an expense`}
            />
          ))}
        </FlexWidget>
      ) : null}
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
        <Pill
          flex={1}
          label="＋ Task"
          tint={c.skyTint}
          tone={c.skyText}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "ticktaka://add?kind=task" }}
          accessibilityLabel="Add a task"
        />
        <Pill
          flex={1}
          label="－ Expense"
          tint={c.coralTint}
          tone={c.coralText}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "ticktaka://add?kind=expense" }}
          accessibilityLabel="Log an expense"
        />
        <Pill
          flex={1}
          label="▶ Focus"
          tint={c.skyTint}
          tone={c.skyText}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "ticktaka://focus" }}
          accessibilityLabel="Start focus"
        />
        <Pill
          flex={1}
          label="🎙 Tiki"
          tint={c.card}
          tone={c.ink}
          clickAction="OPEN_URI"
          clickActionData={{ uri: "ticktaka://assistant?start=talk" }}
          accessibilityLabel="Talk to Tiki"
        />
      </FlexWidget>
    </FlexWidget>
  );
}

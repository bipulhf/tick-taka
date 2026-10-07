// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { formatAmount as formatAmountIn } from "@tick-taka/shared/money";
import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { WidgetCache } from "./widget-cache";
import { type WidgetColors, widgetColors } from "./widget-colors";
import { ACTIONS, TARGET, type WidgetAction, type WidgetSlot, widgetLayout } from "./widget-layout";
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

/** Caption size: the smallest text, as in the app. */
const CAPTION = 13;

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
        ...(flex ? { flex } : { paddingHorizontal: 12 }),
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
        truncate="END"
        style={{ fontSize: CAPTION, fontWeight: "bold", color: tone }}
      />
    </FlexWidget>
  );
}

const ACTION_LINKS: Record<WidgetAction, string> = {
  task: "ticktaka://add?kind=task",
  expense: "ticktaka://add?kind=expense",
  focus: "ticktaka://focus",
  tiki: "ticktaka://assistant?start=talk",
};

/** Task, Expense, Focus or Tiki: its label, or its glyph when the widget is narrow. */
function ActionPill({
  slot,
  c,
}: {
  slot: Extract<WidgetSlot, { kind: "action" }>;
  c: WidgetColors;
}) {
  const action = ACTIONS[slot.action];
  const [tint, tone] =
    slot.action === "expense"
      ? [c.coralTint, c.coralText]
      : slot.action === "tiki"
        ? [c.card, c.ink]
        : [c.skyTint, c.skyText];
  return (
    <Pill
      flex={slot.width}
      label={slot.glyph ? action.glyph : action.label}
      tint={tint}
      tone={tone}
      clickAction="OPEN_URI"
      clickActionData={{ uri: ACTION_LINKS[slot.action] }}
      accessibilityLabel={action.name}
    />
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
  width = 0,
  height = 0,
  now = Date.now(),
}: {
  cache: WidgetCache;
  scheme: "light" | "dark";
  /** The widget's size on the launcher (dp); 0 when it isn't known. */
  width?: number;
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
  const undo = canUndo(cache, now) && cache.lastLog ? cache.lastLog : null;
  const quickLabel = (entry: WidgetCache["quick"][number]) =>
    `${entry.label} ${money(entry.amountMinor)}`;
  const layout = widgetLayout({
    width,
    height,
    quick: cache.quick.map(quickLabel),
    undo: undo !== null,
  });
  const compact = layout.size === "compact";
  const tall = layout.size === "tall";
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
      {layout.undoRow && undo ? (
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
      {layout.quickRow.length > 0 ? (
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
          {layout.quickRow.map((index) => {
            const entry = cache.quick[index];
            return entry ? (
              <Pill
                key={`${entry.note}-${entry.amountMinor}`}
                label={quickLabel(entry)}
                tint={c.card}
                tone={c.ink}
                clickAction="LOG"
                clickActionData={{ index }}
                accessibilityLabel={`Log ${entry.label}, ${money(entry.amountMinor)}, as an expense`}
              />
            ) : null;
          })}
        </FlexWidget>
      ) : null}
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
        {layout.row.map((slot) => {
          if (slot.kind === "action") return <ActionPill key={slot.action} slot={slot} c={c} />;
          if (slot.kind === "undo" && undo)
            return (
              <Pill
                key="undo"
                flex={slot.width}
                label="Undo"
                tint={c.card}
                tone={c.ink}
                clickAction="UNDO_LOG"
                accessibilityLabel={`Undo: remove ${undo.label} ${money(undo.amountMinor)}`}
              />
            );
          if (slot.kind === "keep")
            return (
              <Pill
                key="keep"
                flex={slot.width}
                label="Keep"
                tint={c.card}
                tone={c.muted}
                clickAction="KEEP_LOG"
                accessibilityLabel="Keep it and show the quick-log buttons"
              />
            );
          const entry = slot.kind === "quick" ? cache.quick[slot.index] : undefined;
          return slot.kind === "quick" && entry ? (
            // Weighted by the width each label needs: widgetLayout checked they all fit.
            <Pill
              key={`quick-${slot.index}`}
              flex={slot.width}
              label={quickLabel(entry)}
              tint={c.card}
              tone={c.ink}
              clickAction="LOG"
              clickActionData={{ index: slot.index }}
              accessibilityLabel={`Log ${entry.label}, ${money(entry.amountMinor)}, as an expense`}
            />
          ) : null;
        })}
      </FlexWidget>
    </FlexWidget>
  );
}

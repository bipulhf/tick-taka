// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { formatAmount } from "@tick-taka/shared/money";
import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { WidgetCache } from "./widget-cache";

const COLORS = {
  light: {
    background: "#FFF8EE",
    card: "#FFFFFF",
    ink: "#23202B",
    muted: "#7D7670",
    mint: "#1E9E80",
    mango: "#FFB547",
  },
  dark: {
    background: "#16151C",
    card: "#22202B",
    ink: "#F4F1EA",
    muted: "#A09AA6",
    mint: "#4FD8B5",
    mango: "#FFC266",
  },
} as const;

/** Home-screen widget: today's safe-to-spend plus one-tap buttons for frequent small expenses. */
export function SafeToSpendWidget({
  cache,
  scheme,
}: {
  cache: WidgetCache;
  scheme: "light" | "dark";
}) {
  const c = COLORS[scheme];
  return (
    <FlexWidget
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: c.background,
        borderRadius: 24,
        padding: 14,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      clickAction="OPEN_APP"
    >
      <FlexWidget
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          width: "match_parent",
        }}
      >
        <FlexWidget style={{ flexDirection: "column" }}>
          <TextWidget text="Safe to spend today" style={{ fontSize: 12, color: c.muted }} />
          <TextWidget
            text={
              cache.leftTodayMinor === null
                ? "Set a budget"
                : formatAmount(Math.max(0, cache.leftTodayMinor))
            }
            style={{ fontSize: 26, fontWeight: "bold", color: c.mint }}
          />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: "ticktaka://add" }}
          style={{
            backgroundColor: c.mango,
            borderRadius: 20,
            width: 44,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <TextWidget text="+" style={{ fontSize: 26, color: "#23202B", fontWeight: "bold" }} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
        {cache.quick.map((entry, index) => (
          <FlexWidget
            key={`${entry.note}-${entry.amountMinor}`}
            clickAction="LOG"
            clickActionData={{ index }}
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              paddingHorizontal: 10,
              paddingVertical: 8,
              marginRight: 6,
            }}
          >
            <TextWidget
              text={`${entry.label} ${formatAmount(entry.amountMinor)}`}
              style={{ fontSize: 13, color: c.ink }}
            />
          </FlexWidget>
        ))}
      </FlexWidget>
      {cache.status ? (
        <TextWidget text={cache.status} style={{ fontSize: 11, color: c.muted }} />
      ) : null}
    </FlexWidget>
  );
}

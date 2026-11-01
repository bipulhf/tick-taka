// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget } from "react-native-android-widget";
import { plural } from "@/lib/format";
import { daysLeft } from "../widget-model";
import { widgetMoney } from "../widget-snapshot";
import { Bar, open, Pill, Shell, Words } from "./parts";
import type { WidgetProps } from "./types";

/**
 * Safe to spend (2×2): today's number, how much of today's share is gone, the days
 * left in the month, and − Expense.
 */
export function SafeSpendWidget({ cache, c }: WidgetProps) {
  const money = widgetMoney(cache);
  const left = cache.leftTodayMinor;
  const over = left !== null && left < 0;
  const share = cache.dailyMinor > 0 ? cache.spentTodayMinor / cache.dailyMinor : 0;
  const days = cache.date ? `${plural(daysLeft(cache.date), "day")} left` : null;
  return (
    <Shell
      c={c}
      uri={left === null ? "ticktaka://money/budgets" : "ticktaka://"}
      label="Safe to spend"
      padding={14}
    >
      <Words
        text={cache.status ?? (over ? "Over today's amount by" : "Safe to spend today")}
        color={c.muted}
        bold
      />
      {left === null ? (
        <FlexWidget style={{ flexDirection: "column", width: "match_parent", flexGap: 6 }}>
          <Words text="Set a budget" color={c.ink} size={20} bold />
          <Words text="Budgets give you a daily number." color={c.muted} lines={2} />
        </FlexWidget>
      ) : (
        <FlexWidget style={{ flexDirection: "column", width: "match_parent", flexGap: 6 }}>
          <Words text={money(Math.abs(left))} color={over ? c.outText : c.inText} size={30} bold />
          <Bar value={over ? 1 : share} tone={over ? c.outMark : c.inMark} c={c} />
          <Words
            text={[`${money(cache.spentTodayMinor)} spent`, days].filter(Boolean).join(" · ")}
            color={c.muted}
          />
        </FlexWidget>
      )}
      <FlexWidget style={{ flex: 1 }} />
      <FlexWidget style={{ flexDirection: "row", width: "match_parent" }}>
        <Pill
          label="－ Expense"
          c={c}
          tone="primary"
          flex={1}
          {...open("ticktaka://add?kind=expense")}
          accessibilityLabel="Log an expense"
        />
      </FlexWidget>
    </Shell>
  );
}

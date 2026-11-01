// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget } from "react-native-android-widget";
import { budgetLine, budgetShare, dayOfMonth, monthName } from "../widget-model";
import { widgetMoney } from "../widget-snapshot";
import { Bar, Shell, Spread, Status, Words } from "./parts";
import type { WidgetProps } from "./types";

/** This month (2×2): money in and out, how much of the budgets is used, and the top category. */
export function ThisMonthWidget({ cache, c }: WidgetProps) {
  const money = widgetMoney(cache);
  const month = cache.month;
  const share = budgetShare(month);
  return (
    <Shell c={c} uri="ticktaka://money" label="This month" padding={14}>
      <Words text={month ? monthName(month.month) : "This month"} color={c.muted} bold />
      {month ? (
        <FlexWidget style={{ flex: 1, width: "match_parent", flexDirection: "column", flexGap: 6 }}>
          <Spread
            left={<Words text="In" color={c.ink} bold />}
            right={<Words text={money(month.inMinor)} color={c.inText} bold />}
          />
          <Spread
            left={<Words text="Out" color={c.ink} bold />}
            right={<Words text={money(month.outMinor)} color={c.outText} bold />}
          />
          {share === null ? null : <Bar value={share} tone={c.outMark} c={c} />}
          <Words text={budgetLine(share, dayOfMonth(cache.date))} color={c.muted} lines={2} />
          <FlexWidget style={{ flex: 1 }} />
          {month.top ? (
            <Words
              text={`${month.top.emoji} ${month.top.name} ${money(month.top.amountMinor)} · top`}
              color={c.ink}
              bold
            />
          ) : null}
        </FlexWidget>
      ) : (
        <Status text="Open the app once to fill this in." c={c} />
      )}
    </Shell>
  );
}

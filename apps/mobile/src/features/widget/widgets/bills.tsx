// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget } from "react-native-android-widget";
import type { WidgetBill, WidgetCache } from "../widget-cache";
import type { LookColors } from "../widget-colors";
import { rowsThatFit } from "../widget-layout";
import { billNote, billTap, incomeDue } from "../widget-model";
import { canUndo } from "../widget-optimistic";
import { widgetMoney } from "../widget-snapshot";
import { open, Pill, Shell, Spread, Status, UndoStrip, Words } from "./parts";
import type { WidgetProps } from "./types";

const ROW = 46;
const DEFAULT_HEIGHT = 200;

function BillRow({ bill, cache, c }: { bill: WidgetBill; cache: WidgetCache; c: LookColors }) {
  const money = widgetMoney(cache);
  const today = bill.dueDate === cache.date;
  const tap = billTap(bill, cache);
  const verb = bill.income ? "Received" : "Paid";
  return (
    <FlexWidget
      {...open(`ticktaka://money/recurring/${bill.id}`)}
      style={{
        flexDirection: "row",
        width: "match_parent",
        height: ROW,
        backgroundColor: c.card,
        borderRadius: 12,
        paddingHorizontal: 8,
        alignItems: "center",
        flexGap: 8,
      }}
    >
      <FlexWidget
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: bill.overdue ? c.outMark : today ? c.timeMark : c.track,
        }}
      />
      <FlexWidget style={{ flex: 1, flexDirection: "column" }}>
        <Words text={bill.name} color={c.ink} bold />
        <Words
          text={billNote(bill, cache.date, cache.accounts, cache.accountId)}
          color={bill.overdue ? c.outText : today ? c.timeText : c.muted}
          bold
        />
      </FlexWidget>
      <Words
        text={`${bill.income ? "+" : ""}${money(bill.amountMinor)}`}
        color={bill.income ? c.inText : c.ink}
        bold
      />
      <Pill
        label={verb}
        c={c}
        height={36}
        padding={10}
        {...(tap.kind === "pay"
          ? { clickAction: "PAY", clickActionData: { id: bill.id } }
          : open(tap.uri))}
        accessibilityLabel={`${verb}: ${bill.name}, ${money(bill.amountMinor)}`}
      />
    </FlexWidget>
  );
}

/**
 * Bills due (4×2): what's still to pay this month, income due today, and the next
 * bills (late ones first) with Paid, or Received for income, right on the home screen.
 */
export function BillsWidget({ name, cache, c, height, now }: WidgetProps) {
  const money = widgetMoney(cache);
  const undo = canUndo(cache.undo, now) && cache.undo.widget === name ? cache.undo : null;
  const room = (height > 0 ? height : DEFAULT_HEIGHT) - 24 - 18 - 6 - (undo ? 54 : 0);
  const rows = cache.bills.slice(0, rowsThatFit(room, ROW, 6, 3));
  const income = incomeDue(cache.bills);
  const left =
    cache.billsLeftMinor > 0 ? `Bills · ${money(cache.billsLeftMinor)} still to pay` : "Bills";
  return (
    <Shell c={c} uri="ticktaka://money/bills" label="Bills due">
      <Spread
        left={<Words text={cache.status ?? left} color={c.muted} bold />}
        right={
          income ? (
            <Words
              text={`${income.name} +${money(income.amountMinor)} ${income.overdue ? "due" : "today"}`}
              color={c.inText}
              bold
            />
          ) : null
        }
      />
      {cache.bills.length === 0 ? (
        <Status text="Nothing due. Add rent or internet so nothing sneaks up." c={c} />
      ) : (
        <FlexWidget style={{ flex: 1, width: "match_parent", flexDirection: "column", flexGap: 6 }}>
          {rows.map((bill) => (
            <BillRow key={bill.id} bill={bill} cache={cache} c={c} />
          ))}
        </FlexWidget>
      )}
      {undo ? <UndoStrip undo={undo} c={c} /> : null}
    </Shell>
  );
}

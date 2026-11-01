// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { QuickEntry } from "../widget-cache";
import type { LookColors } from "../widget-colors";
import { chipsThatFit, innerWidth, TARGET } from "../widget-layout";
import { chipLabel } from "../widget-model";
import { canUndo, quickLogLink } from "../widget-optimistic";
import { widgetMoney } from "../widget-snapshot";
import { CAPTION, open, Pill, Shell, Status, UndoStrip } from "./parts";
import type { WidgetProps } from "./types";

const ADD_EXPENSE = "ticktaka://add?kind=expense";

function Chip({
  entry,
  index,
  amount,
  accountId,
  c,
}: {
  entry: QuickEntry;
  index: number;
  amount: string;
  accountId: string | null;
  c: LookColors;
}) {
  // With no account left to log to, the chip opens quick-add with the entry typed in.
  const uri = quickLogLink(entry, accountId);
  return (
    <FlexWidget
      {...(uri
        ? { ...open(uri), accessibilityLabel: `Add ${entry.label}, ${amount}, in the app` }
        : {
            clickAction: "LOG",
            clickActionData: { index },
            accessibilityLabel: `Log ${entry.label}, ${amount}, as an expense`,
          })}
      style={{
        height: TARGET,
        borderRadius: 14,
        paddingHorizontal: 8,
        backgroundColor: c.secondary,
        borderWidth: 1,
        borderColor: c.secondaryEdge,
        flexDirection: "row",
        alignItems: "center",
        flexGap: 4,
      }}
    >
      <TextWidget
        text={`${entry.emoji ? `${entry.emoji} ` : ""}${entry.label}`}
        maxLines={1}
        style={{ fontSize: CAPTION, fontWeight: "bold", color: c.onSecondary }}
      />
      <TextWidget
        text={amount}
        maxLines={1}
        style={{ fontSize: CAPTION, fontWeight: "bold", color: c.outText }}
      />
    </FlexWidget>
  );
}

/**
 * Quick log (4×1): the expenses logged most often as chips. One tap logs it, offline
 * too, with Undo for a few seconds; ＋ opens quick-add.
 */
export function QuickLogWidget({ name, cache, c, width, now }: WidgetProps) {
  const money = widgetMoney(cache);
  const undo = canUndo(cache.undo, now) && cache.undo.widget === name ? cache.undo : null;
  const noAccount = cache.accounts !== null && cache.accounts.length === 0;
  const labels = cache.quick.map((entry) => chipLabel(entry, money(entry.amountMinor)));
  const shown = chipsThatFit(labels, innerWidth(width), [TARGET]);
  const add = (
    <Pill
      label="＋"
      c={c}
      tone="primary"
      padding={0}
      width={TARGET}
      {...open(ADD_EXPENSE)}
      accessibilityLabel="Log an expense"
    />
  );
  return (
    <Shell c={c} uri={ADD_EXPENSE} label="Quick log" direction="row" padding={10}>
      {undo ? (
        <UndoStrip undo={undo} c={c} />
      ) : noAccount ? (
        <FlexWidget style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <Pill
            label="Add your first account"
            c={c}
            tone="primary"
            flex={1}
            {...open("ticktaka://account/new")}
            accessibilityLabel="Add your first account"
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            flex: 1,
            height: "match_parent",
            flexDirection: "row",
            alignItems: "center",
            flexGap: 6,
          }}
        >
          {shown === 0 || cache.status ? (
            <FlexWidget style={{ flex: 1 }}>
              <Status
                text={cache.status ?? "Spends you log twice show up here for one-tap logging."}
                c={c}
              />
            </FlexWidget>
          ) : (
            cache.quick
              .slice(0, shown)
              .map((entry, index) => (
                <Chip
                  key={`${entry.note}-${entry.amountMinor}`}
                  entry={entry}
                  index={index}
                  amount={money(entry.amountMinor)}
                  accountId={cache.accountId}
                  c={c}
                />
              ))
          )}
          {shown > 0 && !cache.status ? <FlexWidget style={{ flex: 1 }} /> : null}
          {add}
        </FlexWidget>
      )}
    </Shell>
  );
}

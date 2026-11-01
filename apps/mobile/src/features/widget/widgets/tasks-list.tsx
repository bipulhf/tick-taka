// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { addDays } from "@tick-taka/shared/dates";
import { FlexWidget, ListWidget } from "react-native-android-widget";
import type { LookColors } from "../widget-colors";
import { type TaskListRow, taskListRows } from "../widget-model";
import { canUndo } from "../widget-optimistic";
import { Check, open, Pill, Shell, Spread, UndoStrip, Words } from "./parts";
import type { WidgetProps } from "./types";

function Row({ row, c }: { row: TaskListRow; c: LookColors }) {
  if (row.kind === "heading")
    return (
      <FlexWidget style={{ width: "match_parent", paddingTop: 6, paddingBottom: 2 }}>
        <Words text={row.text} color={row.tone === "earlier" ? c.outText : c.timeText} bold />
      </FlexWidget>
    );
  if (row.kind === "empty")
    return (
      <FlexWidget style={{ width: "match_parent", paddingVertical: 8 }}>
        <Words text={row.text} color={c.muted} />
      </FlexWidget>
    );
  const { task } = row;
  return (
    <FlexWidget
      {...open(`ticktaka://task/${task.id}`)}
      accessibilityLabel={`Open ${task.title}`}
      style={{
        flexDirection: "row",
        width: "match_parent",
        height: 40,
        alignItems: "center",
        flexGap: 6,
      }}
    >
      <FlexWidget
        {...(task.done
          ? {}
          : {
              clickAction: "TASK_DONE",
              clickActionData: { id: task.id },
              accessibilityLabel: `Tick ${task.title}`,
            })}
        style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
      >
        <Check done={task.done} c={c} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1 }}>
        <Words text={task.title} color={task.done ? c.muted : c.ink} bold={!task.done} />
      </FlexWidget>
      {row.note ? (
        <Words text={row.note} color={row.timed ? c.timeText : c.muted} bold={row.timed} />
      ) : null}
    </FlexWidget>
  );
}

/**
 * Tasks list (4×3, scrolls): tasks left from earlier days, then today's, each with a
 * circle to tick; a row opens the task, ＋ Add opens quick-add.
 */
export function TasksListWidget({ name, cache, c, now }: WidgetProps) {
  const undo = canUndo(cache.undo, now) && cache.undo.widget === name ? cache.undo : null;
  const rows = taskListRows(cache);
  const tomorrow = cache.date ? addDays(cache.date, 1) : null;
  return (
    <Shell c={c} uri="ticktaka://plan" label="Tasks">
      <Spread
        left={<Words text={cache.status ?? "Today"} color={c.ink} size={15} bold />}
        right={
          <Pill
            label="＋ Add"
            c={c}
            tone="primary"
            height={40}
            {...open("ticktaka://add?kind=task")}
            accessibilityLabel="Add a task"
          />
        }
      />
      <FlexWidget style={{ flex: 1, width: "match_parent" }}>
        <ListWidget style={{ height: "match_parent", width: "match_parent" }}>
          {rows.map((row) => (
            <Row key={row.key} row={row} c={c} />
          ))}
        </ListWidget>
      </FlexWidget>
      {undo ? (
        <UndoStrip undo={undo} c={c} />
      ) : cache.tomorrowCount > 0 && tomorrow ? (
        <FlexWidget
          {...open(`ticktaka://plan/day?date=${tomorrow}`)}
          accessibilityLabel={`Tomorrow: ${cache.tomorrowCount} more`}
          style={{ width: "match_parent", paddingVertical: 4 }}
        >
          <Words text={`Tomorrow · ${cache.tomorrowCount} more ›`} color={c.muted} />
        </FlexWidget>
      ) : null}
    </Shell>
  );
}

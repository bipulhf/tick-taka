// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget } from "react-native-android-widget";
import type { WidgetTask } from "../widget-cache";
import type { LookColors } from "../widget-colors";
import { ACTIONS, actionRow, innerWidth, PILL_PADDING, rowsThatFit } from "../widget-layout";
import { doneOf, headerDate, nextLabel, nextTask, todayRows } from "../widget-model";
import { canUndo } from "../widget-optimistic";
import { widgetMoney } from "../widget-snapshot";
import { Check, open, Pill, Shell, Spread, Status, UndoStrip, Words } from "./parts";
import type { WidgetProps } from "./types";

const ACTION_LINKS = {
  task: "ticktaka://add?kind=task",
  expense: "ticktaka://add?kind=expense",
  focus: "ticktaka://focus",
  tiki: "ticktaka://assistant?start=talk",
} as const;

/** The launcher's default 4×2 height on common phones, assumed when it isn't known. */
const DEFAULT_HEIGHT = 200;
const ROW = 30;

/** A task with its circle: a tap on the row ticks it. */
export function TaskLine({
  task,
  c,
  note,
  noteColor,
}: {
  task: WidgetTask;
  c: LookColors;
  note?: string;
  noteColor?: LookColors["muted"];
}) {
  return (
    <FlexWidget
      {...(task.done
        ? { ...open(`ticktaka://task/${task.id}`), accessibilityLabel: `${task.title}, done` }
        : {
            clickAction: "TASK_DONE",
            clickActionData: { id: task.id },
            accessibilityLabel: `Tick ${task.title}`,
          })}
      style={{
        flexDirection: "row",
        width: "match_parent",
        height: ROW,
        alignItems: "center",
        flexGap: 10,
      }}
    >
      <Check done={task.done} c={c} />
      <FlexWidget style={{ flex: 1 }}>
        <Words text={task.title} color={task.done ? c.muted : c.ink} bold={!task.done} />
      </FlexWidget>
      {note ? <Words text={note} color={noteColor ?? c.muted} bold /> : null}
    </FlexWidget>
  );
}

function NextCard({ task, c, timeZone }: { task: WidgetTask; c: LookColors; timeZone: string }) {
  return (
    <FlexWidget
      {...open(`ticktaka://task/${task.id}`)}
      style={{
        width: "match_parent",
        height: "match_parent",
        backgroundColor: c.card,
        borderRadius: 14,
        padding: 8,
        flexDirection: "column",
        justifyContent: "space-between",
        flexGap: 4,
      }}
    >
      <Words text={nextLabel(task, timeZone)} color={c.timeText} bold />
      <Words text={task.title} color={c.ink} bold lines={2} />
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
        <Pill
          label="Done"
          c={c}
          flex={1}
          height={36}
          padding={4}
          clickAction="TASK_DONE"
          clickActionData={{ id: task.id }}
          accessibilityLabel={`Mark ${task.title} done`}
        />
        <Pill
          label="Later"
          c={c}
          flex={1}
          height={36}
          padding={4}
          clickAction="TASK_LATER"
          clickActionData={{ id: task.id }}
          accessibilityLabel={`Move ${task.title} to tomorrow`}
        />
      </FlexWidget>
    </FlexWidget>
  );
}

/**
 * Today (4×2): the date and how much is done, what's safe to spend, the top three to
 * tick, the next thing with Done and Later, and one-tap ways to add a task, log an
 * expense, focus or talk to Tiki.
 */
export function TodayWidget({ name, cache, c, width, height, now }: WidgetProps) {
  const money = widgetMoney(cache);
  const height2 = height > 0 ? height : DEFAULT_HEIGHT;
  const count = rowsThatFit(height2 - 24 - 18 - 48 - 12, ROW, 4, 3);
  const rows = todayRows(cache.tasks, count);
  const next = nextTask(cache.tasks, rows, now);
  const { done, total } = doneOf(cache.tasks);
  const left = cache.leftTodayMinor;
  const undo = canUndo(cache.undo, now) && cache.undo.widget === name ? cache.undo : null;
  const header = [headerDate(cache.date), total ? `${done} of ${total} done` : null]
    .filter(Boolean)
    .join(" · ");
  const cardWidth = Math.min(150, Math.round(innerWidth(width) * 0.42));
  return (
    <Shell c={c} label="Today">
      <Spread
        left={<Words text={cache.status ?? header} color={c.muted} bold />}
        right={
          left === null ? null : (
            <Words
              text={left < 0 ? `Over ${money(-left)}` : `Safe ${money(left)}`}
              color={left < 0 ? c.outText : c.inText}
              bold
            />
          )
        }
      />
      <FlexWidget style={{ flex: 1, flexDirection: "row", width: "match_parent", flexGap: 10 }}>
        <FlexWidget
          style={{ flex: 1, height: "match_parent", flexDirection: "column", flexGap: 4 }}
        >
          {rows.length ? (
            rows.map((task) => <TaskLine key={task.id} task={task} c={c} />)
          ) : (
            <Status
              text={next ? "Your top three show here." : "Nothing planned. Add a task below."}
              c={c}
            />
          )}
        </FlexWidget>
        {next ? (
          <FlexWidget style={{ width: cardWidth, height: "match_parent" }}>
            <NextCard task={next} c={c} timeZone={cache.timeZone} />
          </FlexWidget>
        ) : null}
      </FlexWidget>
      {undo ? (
        <UndoStrip undo={undo} c={c} />
      ) : (
        <FlexWidget style={{ flexDirection: "row", width: "match_parent", flexGap: 6 }}>
          {actionRow({ width, assistant: cache.assistant }).map((slot) => (
            <Pill
              key={slot.action}
              label={slot.glyph ? ACTIONS[slot.action].glyph : ACTIONS[slot.action].label}
              c={c}
              tone={slot.action === "task" ? "primary" : "secondary"}
              flex={slot.width}
              padding={PILL_PADDING}
              {...open(ACTION_LINKS[slot.action])}
              accessibilityLabel={ACTIONS[slot.action].name}
            />
          ))}
        </FlexWidget>
      )}
    </Shell>
  );
}

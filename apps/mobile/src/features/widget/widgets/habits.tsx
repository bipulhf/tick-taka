// The widget library walks this tree as plain functions; the React Compiler must not wrap it.
"use no memo";

import { FlexWidget } from "react-native-android-widget";
import type { WidgetHabit } from "../widget-cache";
import type { LookColors } from "../widget-colors";
import { habitCaption, habitGrid } from "../widget-model";
import { canUndo } from "../widget-optimistic";
import { Ring, Shell, Status, UndoStrip, Words } from "./parts";
import type { WidgetProps } from "./types";

function HabitRing({ habit, c }: { habit: WidgetHabit; c: LookColors }) {
  const full = habit.count >= habit.target;
  return (
    <FlexWidget
      clickAction="HABIT"
      clickActionData={{ id: habit.id }}
      accessibilityLabel={
        full
          ? `${habit.name}, done for today`
          : `${habit.name}, ${habit.count} of ${habit.target}. Tap to add one.`
      }
      style={{
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        flexGap: 2,
        paddingVertical: 2,
      }}
    >
      <Ring
        size={48}
        share={habit.count / habit.target}
        track={c.track}
        arc={c.habitArc}
        emoji={habit.emoji}
      />
      <Words text={habitCaption(habit)} color={full ? c.habitText : c.ink} bold />
    </FlexWidget>
  );
}

/**
 * Habits (2×2, resizable): a ring per habit with its emoji. A tap counts one more for
 * today; a full ring turns solid.
 */
export function HabitsWidget({ name, cache, c, width, height, now }: WidgetProps) {
  const undo = canUndo(cache.undo, now) && cache.undo.widget === name ? cache.undo : null;
  const done = cache.habits.filter((habit) => habit.count >= habit.target).length;
  const grid = habitGrid(width, height - (undo ? 54 : 0), cache.habits.length);
  const shown = cache.habits.slice(0, grid.shown);
  const rows: WidgetHabit[][] = [];
  for (let i = 0; i < shown.length; i += grid.columns) rows.push(shown.slice(i, i + grid.columns));
  return (
    <Shell c={c} uri="ticktaka://plan/habits" label="Habits">
      <Words
        text={
          cache.status ??
          (cache.habits.length ? `Habits · ${done} of ${cache.habits.length}` : "Habits")
        }
        color={c.muted}
        bold
      />
      {cache.habits.length === 0 ? (
        <Status text="No habits yet. Start small, like water or a walk." c={c} />
      ) : (
        <FlexWidget style={{ flex: 1, width: "match_parent", flexDirection: "column", flexGap: 4 }}>
          {rows.map((row) => (
            <FlexWidget
              key={row.map((habit) => habit.id).join("-")}
              style={{ flexDirection: "row", width: "match_parent" }}
            >
              {row.map((habit) => (
                <HabitRing key={habit.id} habit={habit} c={c} />
              ))}
              {row.length < grid.columns ? (
                // A short last row keeps its rings the width of the others.
                <FlexWidget style={{ flex: grid.columns - row.length }} />
              ) : null}
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
      {undo ? <UndoStrip undo={undo} c={c} /> : null}
    </Shell>
  );
}

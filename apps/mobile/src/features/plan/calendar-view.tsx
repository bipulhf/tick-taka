import {
  addDays,
  addMonths,
  daysInMonth,
  firstDayOfMonth,
  lastDayOfMonth,
  localMonthRange,
  startOfWeek,
  toLocalDate,
  weekdayOf,
} from "@tick-taka/shared/dates";
import { nextOccurrence } from "@tick-taka/shared/recurrence";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Icon } from "@/components/ui/icon";
import { Screen } from "@/components/ui/screen";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TASK_ROW_INSET, TaskRow } from "@/features/tasks/task-row";
import { formatLocalDate, formatMonth, plural } from "@/lib/format";
import { useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import { useRecurring, useTasks } from "./queries";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Month and week views showing tasks, time blocks and bills together. */
export function CalendarView() {
  const { data: settings } = useSettings();
  const timeZone = userTime(settings).timeZone;
  const weekStartsOn = userTime(settings).weekStartsOn;
  const today = toLocalDate(Date.now(), timeZone);
  const [mode, setMode] = useState<"month" | "week">("month");
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const range = localMonthRange(month, timeZone);
  const tasks = useTasks({
    status: "inbox,open,done",
    from: String(range.from - 7 * 86_400_000),
    to: String(range.to + 7 * 86_400_000),
  });
  const recurring = useRecurring();

  // Bill and payday occurrences inside the visible range, from each repeat rule.
  const bills = new Map<
    string,
    { id: string; name: string; amountMinor: number; currency: string; kind: string }[]
  >();
  for (const item of recurring.data ?? []) {
    let date: string | null = item.dueDate;
    const end = addDays(lastDayOfMonth(month), 7);
    for (let i = 0; date && date <= end && i < 62; i++) {
      bills.set(date, [...(bills.get(date) ?? []), item]);
      date = nextOccurrence(item.rrule, item.dueDate, date);
    }
  }
  const tasksOn = (date: string) =>
    (tasks.data ?? []).filter((t) => t.doAt !== null && toLocalDate(t.doAt, timeZone) === date);

  const gridStart = startOfWeek(firstDayOfMonth(month), weekStartsOn);
  const leading = (weekdayOf(firstDayOfMonth(month)) - weekStartsOn + 7) % 7;
  const monthCells = Math.ceil((leading + daysInMonth(month)) / 7) * 7;
  const cells = Array.from({ length: mode === "month" ? monthCells : 7 }, (_, i) =>
    mode === "month" ? addDays(gridStart, i) : addDays(startOfWeek(selected, weekStartsOn), i),
  );
  const headers = Array.from({ length: 7 }, (_, i) => WEEKDAYS[(weekStartsOn + i) % 7] ?? "");
  const dayTasks = tasksOn(selected);
  const dayBills = bills.get(selected) ?? [];

  return (
    <Screen
      title={formatMonth(month)}
      tabBarPadding={false}
      right={
        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            className="h-12 w-12 items-center justify-center"
            onPress={() => setMonth(addMonths(month, -1))}
            accessibilityLabel="Previous month"
          >
            <Icon name="chevron-left" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="h-12 w-12 items-center justify-center"
            onPress={() => setMonth(addMonths(month, 1))}
            accessibilityLabel="Next month"
          >
            <Icon name="chevron-right" />
          </Pressable>
        </View>
      }
    >
      <Segmented
        kind="tabs"
        value={mode}
        onChange={setMode}
        options={[
          { value: "month", label: "Month" },
          { value: "week", label: "Week" },
        ]}
      />
      <Card className="p-2">
        <View className="flex-row">
          {headers.map((label, i) => (
            <Text
              key={`${label}-${i.toString()}`}
              variant="caption"
              tone="muted"
              className="flex-1 text-center"
            >
              {label}
            </Text>
          ))}
        </View>
        <View className="flex-row flex-wrap">
          {cells.map((date) => {
            const inMonth = date.slice(0, 7) === month;
            const count = tasksOn(date).filter((t) => t.status !== "done").length;
            const timed = tasksOn(date).some((t) => t.hasTime);
            const hasBills = (bills.get(date) ?? []).length > 0;
            const isSelected = date === selected;
            return (
              <Pressable
                key={date}
                onPress={() => setSelected(date)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${formatLocalDate(date)}, ${plural(count, "task")}${hasBills ? ", bills due" : ""}`}
                hitSlop={{ left: 3, right: 3 }}
                className={`min-h-14 w-[14.28%] items-center justify-center rounded-xl py-1 ${isSelected ? "bg-ink" : date === today ? "bg-sky/15" : ""}`}
              >
                <Text
                  variant="strong"
                  tone={isSelected ? "background" : inMonth ? "ink" : "muted"}
                  numeric
                  maxFontSizeMultiplier={1.3}
                >
                  {Number(date.slice(8))}
                </Text>
                <View className="mt-0.5 h-1.5 flex-row gap-0.5">
                  {/* Tasks are a sky dot, timed tasks a sky ring, bills a coral dot. */}
                  {count > 0 ? (
                    <View
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-background" : "bg-sky"}`}
                    />
                  ) : null}
                  {timed ? (
                    <View
                      className={`h-1.5 w-1.5 rounded-full border ${isSelected ? "border-background" : "border-sky"}`}
                    />
                  ) : null}
                  {hasBills ? (
                    <View
                      className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-background" : "bg-coral"}`}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
      <Text variant="heading">{formatLocalDate(selected, "long")}</Text>
      <AsyncContent
        query={tasks}
        skeleton={<SkeletonList rows={3} />}
        isEmpty={() => dayTasks.length === 0 && dayBills.length === 0}
        empty={
          <EmptyState
            title="A free day"
            message="Nothing planned or due. Enjoy the room to breathe."
            mood="relaxed"
          />
        }
      >
        {() => (
          <>
            {dayBills.map((bill) => (
              <Card key={bill.id} className="flex-row items-center gap-3 py-3">
                <Icon
                  name={bill.kind === "bill" ? "receipt" : "cash-plus"}
                  color={bill.kind === "bill" ? "coral" : "mint"}
                />
                <Text className="flex-1">{bill.name}</Text>
                <Amount
                  minor={bill.amountMinor}
                  currency={bill.currency}
                  variant="strong"
                  animate={false}
                />
              </Card>
            ))}
            <Group inset={TASK_ROW_INSET}>
              {dayTasks.map((task) => (
                <TaskRow key={task.id} task={task} />
              ))}
            </Group>
          </>
        )}
      </AsyncContent>
    </Screen>
  );
}

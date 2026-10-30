import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Repeat, RotateCcw, Undo2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Ring } from "@/components/ui/progress";
import { Section, SectionAction } from "@/components/ui/section";
import type { TodayData } from "@/lib/queries";
import { playSound } from "@/lib/sounds";
import { notify } from "@/lib/toast";
import { updateToday } from "@/lib/today-cache";
import { fire } from "@/lib/write";
import { habitTap, takeOneBack } from "./habit-tap";

type Habit = TodayData["habits"][number];

function HabitChip({
  habit,
  onTap,
  onReset,
  onTakeBack,
}: {
  habit: Habit;
  onTap: () => void;
  onReset: () => void;
  onTakeBack: () => void;
}) {
  const progress = Math.min(1, habit.todayCount / habit.targetCount);
  return (
    <li className="group/chip relative flex w-[84px] flex-col items-center gap-1">
      <button
        type="button"
        onClick={onTap}
        aria-label={`${habit.name}, ${habit.todayCount} of ${habit.targetCount}${habit.doneToday ? ", done" : ""}. Count one`}
        className="flex flex-col items-center gap-1 rounded-2xl px-1 pt-1 pb-0.5 hover:bg-line/30"
      >
        {/* Always grape: purple means habits; the emoji tells habits apart. */}
        <Ring value={progress} size={56} stroke={4} tone="grape">
          <span
            aria-hidden
            className={`flex size-11 items-center justify-center rounded-full text-2xl ${habit.doneToday ? "bg-grape/15" : ""}`}
          >
            {habit.emoji}
          </span>
        </Ring>
        <span className="line-clamp-2 w-full text-center text-caption">{habit.name}</span>
        <span aria-hidden className="h-[18px] text-caption text-grape-text tabular">
          {habit.targetCount > 1
            ? `${habit.todayCount}/${habit.targetCount}`
            : habit.streak.current > 0
              ? `🔥 ${habit.streak.current}`
              : ""}
        </span>
      </button>
      {habit.todayCount > 0 ? (
        <div className="absolute top-0 right-0">
          <Menu
            items={[
              { label: "Take one back", icon: Undo2, onSelect: onTakeBack },
              { label: "Reset today", icon: RotateCcw, onSelect: onReset },
            ]}
            trigger={
              <IconButton
                icon={MoreHorizontal}
                label={`More for ${habit.name}`}
                size="sm"
                tooltip={false}
                className="size-6 rounded-full bg-card [@media(hover:hover)]:opacity-0 group-hover/chip:opacity-100 group-focus-within/chip:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              />
            }
          />
        </div>
      ) : null}
    </li>
  );
}

/** Today's habits as grape rings: one click counts one; taking one back is explicit. */
export function HabitChips({ data }: { data: TodayData }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const openHabits = () => void navigate({ to: "/plan/habits" });
  const setCount = (habit: Habit, count: number) => {
    const done = count >= habit.targetCount;
    updateToday(client, (d) => ({
      ...d,
      habits: d.habits.map((h) =>
        h.id === habit.id ? { ...h, todayCount: count, doneToday: done } : h,
      ),
    }));
    fire({
      method: "PUT",
      path: `/habits/${habit.id}/logs/${data.date}`,
      body: { count },
      label: `Couldn't update ${habit.name}`,
    });
    if (done && !habit.doneToday) playSound("done");
  };

  return (
    <Section
      title="Habits"
      id="today-habits"
      action={<SectionAction onClick={openHabits}>All</SectionAction>}
    >
      {data.habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No habits yet"
          message="Start small, like water or a walk."
          actionLabel="Add"
          onAction={openHabits}
        />
      ) : (
        <ul className="flex flex-wrap gap-x-2 gap-y-3 rounded-2xl bg-card px-3 py-4">
          {data.habits.map((habit) => (
            <HabitChip
              key={habit.id}
              habit={habit}
              onTap={() => {
                const tap = habitTap(habit.todayCount, habit.targetCount);
                if (tap.kind === "count") return setCount(habit, tap.next);
                // Already done: a stray click changes nothing; taking one back is explicit.
                notify(`${habit.name} is done for today`, {
                  label: "Take one back",
                  onPress: () => setCount(habit, takeOneBack(habit.todayCount)),
                });
              }}
              onTakeBack={() => setCount(habit, takeOneBack(habit.todayCount))}
              onReset={() => {
                const before = habit.todayCount;
                setCount(habit, 0);
                notify(`Reset ${habit.name}`, {
                  label: "Undo",
                  onPress: () => setCount({ ...habit, todayCount: 0, doneToday: false }, before),
                });
              }}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

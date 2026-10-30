import { createFileRoute } from "@tanstack/react-router";
import { HabitList } from "@/features/habits/habit-list";

export const Route = createFileRoute("/_auth/_shell/plan/habits")({
  component: HabitList,
});

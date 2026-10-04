import { useLocalSearchParams } from "expo-router";
import { HabitSheet } from "@/features/habits/habit-sheet";

export default function HabitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HabitSheet id={id === "new" ? null : id} />;
}

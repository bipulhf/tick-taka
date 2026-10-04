import { useLocalSearchParams } from "expo-router";
import { GoalSheet } from "@/features/money/goal-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GoalSheet id={id === "new" ? null : id} />;
}

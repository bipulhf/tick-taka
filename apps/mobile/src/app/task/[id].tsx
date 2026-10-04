import { useLocalSearchParams } from "expo-router";
import { TaskSheet } from "@/features/tasks/task-sheet";

export default function TaskRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TaskSheet id={id === "new" ? null : id} />;
}

import { useLocalSearchParams } from "expo-router";
import { FocusScreen } from "@/features/focus/focus-screen";

export default function FocusRoute() {
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  return <FocusScreen taskId={taskId ?? null} />;
}

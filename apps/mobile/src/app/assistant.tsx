import { useLocalSearchParams } from "expo-router";
import { AssistantSheet } from "@/features/assistant/assistant-sheet";

/** `?start=talk` (from the home-screen widget) opens the chat already listening. */
export default function AssistantRoute() {
  const { start } = useLocalSearchParams<{ start?: string }>();
  return <AssistantSheet start={start === "talk" ? "talk" : undefined} />;
}

import { useLocalSearchParams } from "expo-router";
import { screenFromParams } from "@/features/assistant/assistant-screen";
import { AssistantSheet } from "@/features/assistant/assistant-sheet";

/**
 * `?start=talk` (from the home-screen widget) opens the chat already listening;
 * `view`, `kind` and `id` say what the user was looking at when they opened it.
 */
export default function AssistantRoute() {
  const params = useLocalSearchParams<{
    start?: string;
    view?: string;
    kind?: string;
    id?: string;
  }>();
  return (
    <AssistantSheet
      start={params.start === "talk" ? "talk" : undefined}
      screen={screenFromParams(params)}
    />
  );
}

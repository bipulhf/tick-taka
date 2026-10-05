import { useLocalSearchParams } from "expo-router";
import { EventSheet } from "@/features/money/event-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EventSheet id={id} />;
}

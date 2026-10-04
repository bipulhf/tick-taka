import { useLocalSearchParams } from "expo-router";
import { RecurringSheet } from "@/features/money/recurring-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RecurringSheet id={id === "new" ? null : id} />;
}

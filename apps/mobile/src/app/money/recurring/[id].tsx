import { useLocalSearchParams } from "expo-router";
import { RecurringSheet } from "@/features/money/recurring-sheet";

export default function Route() {
  const { id, pay } = useLocalSearchParams<{ id: string; pay?: string }>();
  return <RecurringSheet id={id === "new" ? null : id} askAccount={pay === "account"} />;
}

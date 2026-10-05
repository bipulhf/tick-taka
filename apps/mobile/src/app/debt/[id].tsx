import { useLocalSearchParams } from "expo-router";
import { DebtSheet } from "@/features/money/debt-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DebtSheet id={id === "new" ? null : id} />;
}

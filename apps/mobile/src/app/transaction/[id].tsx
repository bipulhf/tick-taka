import { useLocalSearchParams } from "expo-router";
import { TransactionSheet } from "@/features/money/transaction-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransactionSheet id={id === "new" ? null : id} />;
}

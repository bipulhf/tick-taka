import { useLocalSearchParams } from "expo-router";
import { AccountSheet } from "@/features/money/account-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountSheet id={id === "new" ? null : id} />;
}

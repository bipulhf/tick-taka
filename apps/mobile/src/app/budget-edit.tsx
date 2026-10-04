import { toLocalMonth } from "@tick-taka/shared/dates";
import { useLocalSearchParams } from "expo-router";
import { BudgetEditSheet } from "@/features/money/budget-edit-sheet";

export default function BudgetEditRoute() {
  const { month, suggested } = useLocalSearchParams<{ month?: string; suggested?: string }>();
  return (
    <BudgetEditSheet
      month={month ?? toLocalMonth(Date.now())}
      suggested={suggested ? (JSON.parse(suggested) as Record<string, number>) : undefined}
    />
  );
}

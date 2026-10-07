import { useLocalSearchParams } from "expo-router";
import { BudgetEditSheet } from "@/features/money/budget-edit-sheet";
import { useThisMonth } from "@/lib/use-today";

export default function BudgetEditRoute() {
  const { month, suggested } = useLocalSearchParams<{ month?: string; suggested?: string }>();
  const thisMonth = useThisMonth();
  return (
    <BudgetEditSheet
      month={month ?? thisMonth}
      suggested={suggested ? (JSON.parse(suggested) as Record<string, number>) : undefined}
    />
  );
}

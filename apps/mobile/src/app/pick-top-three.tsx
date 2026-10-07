import { useLocalSearchParams } from "expo-router";
import { PickTopThreeSheet } from "@/features/tasks/pick-top-three-sheet";
import { useTodayDate } from "@/lib/use-today";

export default function PickTopThreeRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const today = useTodayDate();
  return <PickTopThreeSheet date={date ?? today} />;
}

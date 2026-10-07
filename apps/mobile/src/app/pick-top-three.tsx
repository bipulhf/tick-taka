import { useLocalSearchParams } from "expo-router";
import { PickTopThreeSheet } from "@/features/tasks/pick-top-three-sheet";
import { useToday } from "@/lib/use-today";

export default function PickTopThreeRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const today = useToday();
  return <PickTopThreeSheet date={date ?? today} />;
}

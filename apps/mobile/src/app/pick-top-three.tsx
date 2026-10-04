import { toLocalDate } from "@tick-taka/shared/dates";
import { useLocalSearchParams } from "expo-router";
import { PickTopThreeSheet } from "@/features/tasks/pick-top-three-sheet";

export default function PickTopThreeRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <PickTopThreeSheet date={date ?? toLocalDate(Date.now())} />;
}

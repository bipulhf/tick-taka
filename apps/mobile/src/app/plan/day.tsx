import { toLocalDate } from "@tick-taka/shared/dates";
import { useLocalSearchParams } from "expo-router";
import { DayTimeline } from "@/features/plan/day-timeline";

export default function DayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return <DayTimeline date={date ?? toLocalDate(Date.now())} />;
}

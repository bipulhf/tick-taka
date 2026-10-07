import { useLocalSearchParams } from "expo-router";
import { DayTimeline } from "@/features/plan/day-timeline";
import { useToday } from "@/lib/use-today";

export default function DayRoute() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const today = useToday();
  return <DayTimeline date={date ?? today} />;
}

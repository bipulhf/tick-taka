import { useLocalSearchParams } from "expo-router";
import { TimeEntrySheet } from "@/features/time/time-entry-sheet";

export default function TimeEntryRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <TimeEntrySheet id={id} />;
}

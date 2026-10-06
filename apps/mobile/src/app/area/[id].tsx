import { useLocalSearchParams } from "expo-router";
import { AreaSheet } from "@/features/plan/area-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AreaSheet id={id === "new" ? null : id} />;
}

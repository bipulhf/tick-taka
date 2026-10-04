import { useLocalSearchParams } from "expo-router";
import { RoutineRunner } from "@/features/routines/routine-runner";

export default function RoutineRoute() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  return <RoutineRunner id={id} startInEdit={edit === "1"} />;
}

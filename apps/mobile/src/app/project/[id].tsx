import { useLocalSearchParams } from "expo-router";
import { ProjectSheet } from "@/features/plan/project-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectSheet id={id === "new" ? null : id} />;
}

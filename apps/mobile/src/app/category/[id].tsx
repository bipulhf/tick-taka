import { useLocalSearchParams } from "expo-router";
import { CategorySheet } from "@/features/settings/category-sheet";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CategorySheet id={id} />;
}

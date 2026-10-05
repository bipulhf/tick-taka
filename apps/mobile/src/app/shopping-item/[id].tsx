import { useLocalSearchParams } from "expo-router";
import { ShoppingItemSheet } from "@/features/money/shopping-item-sheet";

export default function Route() {
  const { id, list } = useLocalSearchParams<{ id: string; list?: string }>();
  return <ShoppingItemSheet id={id} list={list} />;
}

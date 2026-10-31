import { useLocalSearchParams } from "expo-router";
import { PlanHome, type PlanTab } from "@/features/plan/plan-home";

const TABS: PlanTab[] = ["inbox", "upcoming", "projects"];

export default function PlanTabRoute() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <PlanHome tab={TABS.find((t) => t === tab)} />;
}

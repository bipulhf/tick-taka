import { useLocalSearchParams } from "expo-router";
import { AreaDetail } from "@/features/plan/area-detail";

export default function AreaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AreaDetail areaId={id} />;
}

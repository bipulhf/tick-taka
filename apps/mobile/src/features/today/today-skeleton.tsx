import { View } from "react-native";
import { Skeleton, SkeletonCard, SkeletonList } from "@/components/ui/skeleton";

/** Today's layout in outline while the first load runs. */
export function TodaySkeleton() {
  return (
    <>
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-24" />
        </View>
        <View className="flex-row items-center gap-4">
          <View className="flex-1 gap-3">
            <Skeleton className="h-9 w-3/4 rounded-2xl" />
            <Skeleton className="h-4 w-2/3" />
          </View>
          <Skeleton className="h-[72px] w-[72px]" />
        </View>
      </View>
      <SkeletonCard hero lines={1} />
      <View className="gap-3">
        <Skeleton className="h-5 w-28" />
        <SkeletonList rows={3} leading="circle" />
      </View>
    </>
  );
}

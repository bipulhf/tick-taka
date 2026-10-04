import { REWARDS } from "@tick-taka/shared/gamification";
import { View } from "react-native";
import { Tiki, type TikiOutfit } from "@/components/tiki/tiki";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard, SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { plural } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { useSettings } from "@/lib/queries";
import { useGamification } from "./queries";

/** Sparks raise a level that unlocks cosmetic rewards only: themes, outfits, icons. */
export function RewardsScreen() {
  const send = useOutbox();
  const game = useGamification();
  const { data: settings } = useSettings();
  const data = game.data;
  if (!data)
    return (
      <Screen title="Rewards" tabBarPadding={false}>
        {game.isError ? (
          <ErrorState onRetry={() => void game.refetch()} />
        ) : (
          <>
            <SkeletonCard hero lines={2} />
            <SkeletonList rows={4} />
          </>
        )}
      </Screen>
    );
  const unlocked = new Set(data.rewards.map((r) => r.id));
  const outfit = (settings?.tikiOutfit ?? null) as TikiOutfit;
  return (
    <Screen title="Rewards" tabBarPadding={false}>
      <Card className="items-center gap-2">
        <Tiki mood="cheering" size={110} outfit={outfit} />
        <Text variant="title">Level {data.level.level}</Text>
        <ProgressBar value={data.level.progress} tone="mango" className="w-full" />
        <Text tone="muted" numeric>
          {data.sparks} sparks · {data.level.nextLevelSparks - data.sparks} to go
        </Text>
        <Text variant="caption" tone="muted">
          Logging streak {plural(data.loggingStreak.current, "day")} · Daily goal streak{" "}
          {plural(data.dailyGoal.streak.current, "day")}
        </Text>
      </Card>
      {REWARDS.map((reward) => {
        const isUnlocked = unlocked.has(reward.id);
        const active =
          reward.kind === "outfit"
            ? settings?.tikiOutfit === reward.id
            : reward.kind === "theme"
              ? settings?.rewardTheme === reward.id
              : false;
        return (
          <Card
            key={reward.id}
            className={`flex-row items-center gap-3 ${isUnlocked ? "" : "opacity-50"}`}
          >
            <Text className="text-2xl">
              {reward.kind === "outfit" ? "🎩" : reward.kind === "theme" ? "🎨" : "📱"}
            </Text>
            <View className="flex-1">
              <Text variant="strong">{reward.name}</Text>
              <Text variant="caption" tone="muted">
                {isUnlocked ? "Unlocked" : `Level ${reward.level}`}
              </Text>
            </View>
            {isUnlocked && reward.kind !== "icon" ? (
              <Chip
                label={active ? "On" : "Use"}
                selected={active}
                onPress={() =>
                  send({
                    method: "PATCH",
                    path: "/settings",
                    body:
                      reward.kind === "outfit"
                        ? { tikiOutfit: active ? null : reward.id }
                        : { rewardTheme: active ? null : reward.id },
                  })
                }
              />
            ) : null}
          </Card>
        );
      })}
      <Text variant="caption" tone="muted">
        Sparks: finished tasks, focus sessions, same-day logging and habits. No penalties, ever.
      </Text>
    </Screen>
  );
}

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { formatAmount, formatLocalDate, formatMinutes } from "@/lib/format";
import { habitStreakText, planShare, winLines } from "@/lib/gentle-progress";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { usePrivacy } from "@/lib/privacy";
import { useAiStatus, useAreas, useCategories } from "@/lib/queries";
import { useWeeklyReview } from "./queries";

const STEPS = ["Hours", "Spending", "Habits", "Wins", "Next week"] as const;

/** A 5-minute guided Sunday flow. The coach explains numbers; it never calculates them. */
export function WeeklyReview() {
  const router = useRouter();
  const send = useOutbox();
  const hidden = usePrivacy();
  const review = useWeeklyReview();
  const ai = useAiStatus();
  const { data: areas = [] } = useAreas();
  const { data: categories = [] } = useCategories();
  const [step, setStep] = useState(0);
  const [focus, setFocus] = useState("");
  const coach = useMutation({
    mutationFn: () => unwrap(api.ai["weekly-review"].$post({ json: {} })),
    onError: (e) => notify(friendlyError(e)),
  });
  const data = review.data;
  if (!data)
    return (
      <Screen title="Weekly review" tabBarPadding={false}>
        {review.isError ? (
          <ErrorState onRetry={() => void review.refetch()} />
        ) : (
          <>
            <SkeletonCard lines={3} />
            <SkeletonCard lines={2} />
          </>
        )}
      </Screen>
    );
  const area = (id: string | null) => areas.find((a) => a.id === id);
  const money = (minor: number) => (hidden ? "•••" : formatAmount(minor));

  return (
    <Screen
      title="Weekly review"
      subtitle={`Week of ${formatLocalDate(data.weekStart)}`}
      tabBarPadding={false}
    >
      <View className="flex-row gap-1">
        {STEPS.map((label, i) => (
          <View
            key={label}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-grape" : "bg-line"}`}
          />
        ))}
      </View>
      <Text variant="heading">{STEPS[step]}</Text>
      {step === 0 && data.hoursVsPlan.length === 0 ? (
        <EmptyState
          title="No hours this week"
          message="Plan or track time this week and it shows up here."
          mood="relaxed"
        />
      ) : null}
      {step === 0 && data.hoursVsPlan.length > 0 ? (
        <Card className="gap-3">
          {data.hoursVsPlan.map((row) => {
            const share = planShare(row.trackedMinutes, row.plannedMinutes);
            return (
              <View key={row.areaId ?? "none"} className="gap-1">
                <View className="flex-row justify-between">
                  <Text>
                    {area(row.areaId)
                      ? `${area(row.areaId)?.emoji} ${area(row.areaId)?.name}`
                      : "No area"}
                  </Text>
                  <Text variant="caption" tone="muted" numeric>
                    {formatMinutes(row.trackedMinutes)} of {formatMinutes(row.plannedMinutes)}{" "}
                    planned
                    {share.extraMinutes ? ` · +${formatMinutes(share.extraMinutes)}` : ""}
                  </Text>
                </View>
                {/* Over plan: the planned share in full sky, the extra lighter, never the same as on plan. */}
                <View
                  className="h-2.5 flex-row overflow-hidden rounded-full bg-line"
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: Math.round(share.filled * 100),
                  }}
                >
                  <View
                    className="h-full rounded-full bg-sky"
                    style={{
                      width: `${share.filled * 100}%`,
                    }}
                  />
                  {share.extraMinutes ? <View className="h-full flex-1 bg-sky/40" /> : null}
                </View>
              </View>
            );
          })}
        </Card>
      ) : null}
      {step === 1 ? (
        <Card className="gap-2">
          <Text variant="title" numeric>
            {money(data.spending.spentMinor)}
          </Text>
          <Text tone="muted">
            against a flexible weekly share of {money(data.spending.flexibleWeeklyBudgetMinor)}
          </Text>
          {data.spending.byCategory.slice(0, 5).map((row) => {
            const category = categories.find((c) => c.id === row.categoryId);
            return (
              <View key={row.categoryId ?? "none"} className="flex-row justify-between">
                <Text>{category ? `${category.emoji} ${category.name}` : "Uncategorised"}</Text>
                <Text numeric>{money(row.amountMinor)}</Text>
              </View>
            );
          })}
        </Card>
      ) : null}
      {step === 2 && data.habits.length === 0 ? (
        <EmptyState
          title="No habits yet"
          message="Start one small habit and its streak will show up here."
          actionLabel="Add a habit"
          onAction={() => router.push("/plan/habits")}
        />
      ) : null}
      {step === 2 && data.habits.length > 0 ? (
        <Card className="gap-2">
          {data.habits.map((habit) => (
            <View key={habit.id} className="flex-row justify-between">
              <Text>
                {habit.emoji} {habit.name}
              </Text>
              <Text tone="grape" numeric>
                {habitStreakText(habit.streak, habit.best, habit.unit)}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      {step === 3 ? (
        <Card className="gap-2">
          {winLines({
            ...data.wins,
            highlights: data.wins.highlights.length,
            formatMinutes,
          }).map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          {data.wins.highlights.map((title) => (
            <Text key={title} tone="muted">
              • {title}
            </Text>
          ))}
        </Card>
      ) : null}
      {step === 4 ? (
        <>
          <TextField
            label="Next week's focus"
            value={focus}
            onChangeText={setFocus}
            placeholder={data.focus ?? "Finish the paper draft"}
          />
          {ai.data?.configured && ai.data.features.weeklyReview ? (
            <Button
              label="Ask the coach"
              icon="auto-fix"
              variant="secondary"
              loading={coach.isPending}
              onPress={() => coach.mutate()}
            />
          ) : null}
          {coach.data ? (
            <Card className="gap-2">
              {coach.data.observations.map((line) => (
                <Text key={line}>• {line}</Text>
              ))}
              <Text variant="strong">{coach.data.suggestion}</Text>
            </Card>
          ) : null}
        </>
      ) : null}
      <View className="flex-row gap-2">
        {step > 0 ? (
          <Button
            label="Back"
            variant="secondary"
            onPress={() => setStep(step - 1)}
            className="flex-1"
          />
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button label="Next" onPress={() => setStep(step + 1)} className="flex-1" />
        ) : (
          <Button
            label="Finish"
            onPress={() => {
              if (focus.trim())
                send({ method: "PATCH", path: "/settings", body: { weeklyFocus: focus.trim() } });
              notify("Week closed. See you next Sunday.");
              router.back();
            }}
            className="flex-1"
          />
        )}
      </View>
      {step === STEPS.length - 1 ? (
        <View className="items-center">
          <Tiki mood="proud" size={64} />
        </View>
      ) : null}
    </Screen>
  );
}

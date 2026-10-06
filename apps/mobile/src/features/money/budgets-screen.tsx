import { addMonths, toLocalMonth } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonCard } from "@/components/ui/skeleton";
import { editDelete, SwipeRow, SwipeRowPressable } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { formatMonth } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useBudgets } from "./queries";

const BUCKETS = [
  { key: "flexible", title: "Flexible", hint: "Food, rides, fun. Drives safe to spend." },
  { key: "fixed", title: "Fixed", hint: "Rent, bills: already planned." },
  { key: "non_monthly", title: "Non-monthly", hint: "Yearly renewals, Eid: a slice each month." },
] as const;

/** Monthly limits in three buckets, with rollover and a calm pace heads-up. */
export function BudgetsScreen() {
  const router = useRouter();
  const [month, setMonth] = useState(() => toLocalMonth(Date.now()));
  const send = useOutbox();
  const budgets = useBudgets(month);
  const data = budgets.data;
  const edit = () => router.push(`/budget-edit?month=${month}`);
  /** The API sets a whole month at once, so dropping one line re-sends the others. */
  const removeLine = (line: { categoryId: string; name: string }) => {
    if (!data) return;
    const before = data.lines
      .filter((l) => l.hasBudget)
      .map(({ categoryId, limitMinor, rollover }) => ({ categoryId, limitMinor, rollover }));
    const put = (lines: typeof before, label: string) =>
      send({ method: "PUT", path: "/budgets", body: { month, budgets: lines }, label });
    put(
      before.filter((l) => l.categoryId !== line.categoryId),
      "Couldn't delete",
    );
    haptic.tap();
    notify(`Deleted the ${line.name} budget`, {
      label: "Undo",
      onPress: () => put(before, "Couldn't undo"),
    });
  };
  return (
    <Screen
      title="Budgets"
      subtitle={formatMonth(month)}
      tabBarPadding={false}
      right={
        <View className="flex-row">
          <Pressable
            className="h-12 w-12 items-center justify-center"
            onPress={() => setMonth(addMonths(month, -1))}
            accessibilityLabel="Previous month"
          >
            <Icon name="chevron-left" />
          </Pressable>
          <Pressable
            className="h-12 w-12 items-center justify-center"
            onPress={() => setMonth(addMonths(month, 1))}
            accessibilityLabel="Next month"
          >
            <Icon name="chevron-right" />
          </Pressable>
        </View>
      }
    >
      {data?.inherited ? (
        <Text tone="muted">
          Showing last month's limits. Save to keep them for {formatMonth(month)}.
        </Text>
      ) : null}
      <Button
        label="Edit budgets"
        variant="secondary"
        icon="pencil"
        onPress={() => router.push(`/budget-edit?month=${month}`)}
      />
      <AsyncContent
        query={budgets}
        skeleton={
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        }
        isEmpty={(loaded) => loaded.lines.every((l) => !l.hasBudget && l.spentMinor === 0)}
        empty={
          <EmptyState
            title="No budgets yet"
            message="Give a few categories a monthly limit so you can spend without second-guessing."
            actionLabel="Set budgets"
            onAction={() => router.push(`/budget-edit?month=${month}`)}
          />
        }
      >
        {(data) =>
          BUCKETS.map((bucket) => {
            const totals = data.buckets[bucket.key];
            const lines = data.lines.filter(
              (l) =>
                l.budgetType === bucket.key &&
                (l.hasBudget || l.spentMinor > 0) &&
                (l.parentId === null || l.hasBudget),
            );
            // A group with nothing budgeted or spent is just noise ("৳0 of ৳0").
            if (totals.limitMinor === 0 && totals.spentMinor === 0 && lines.length === 0)
              return null;
            return (
              <Section key={bucket.key} title={bucket.title}>
                <Card className="gap-3">
                  <View className="flex-row items-baseline justify-between">
                    <Amount minor={totals.spentMinor} variant="heading" />
                    <Text variant="caption" tone="muted">
                      of{" "}
                      <Amount
                        minor={totals.limitMinor}
                        variant="caption"
                        tone="muted"
                        animate={false}
                      />
                    </Text>
                  </View>
                  <ProgressBar
                    value={totals.limitMinor ? totals.spentMinor / totals.limitMinor : 0}
                    tone={totals.availableMinor < 0 ? "coral" : "mint"}
                  />
                  <Text variant="caption" tone="muted">
                    {bucket.hint}
                  </Text>
                  {lines.map((line) => (
                    <SwipeRow
                      key={line.categoryId}
                      actions={
                        line.hasBudget
                          ? editDelete(edit, () => removeLine(line))
                          : [{ label: "Edit", icon: "pencil-outline", tone: "sky", onPress: edit }]
                      }
                    >
                      <SwipeRowPressable
                        onPress={edit}
                        className="gap-1 bg-card active:opacity-70"
                        accessibilityHint="Opens the budget. More is in the actions menu"
                      >
                        <View className="flex-row justify-between">
                          <Text>
                            {line.emoji} {line.name}
                            {line.pace === "ahead" ? "  · running ahead" : ""}
                          </Text>
                          <Text
                            variant="caption"
                            tone={line.availableMinor < 0 ? "coral" : "muted"}
                          >
                            <Amount
                              minor={line.spentMinor}
                              variant="caption"
                              tone="ink"
                              animate={false}
                            />
                            {line.hasBudget ? (
                              <>
                                {" / "}
                                <Amount
                                  minor={line.limitMinor + line.carriedMinor}
                                  variant="caption"
                                  tone="muted"
                                  animate={false}
                                />
                              </>
                            ) : null}
                          </Text>
                        </View>
                        {line.hasBudget ? (
                          <ProgressBar
                            value={
                              line.limitMinor + line.carriedMinor > 0
                                ? line.spentMinor / (line.limitMinor + line.carriedMinor)
                                : 1
                            }
                            tone={
                              line.availableMinor < 0
                                ? "coral"
                                : line.pace === "ahead"
                                  ? "mango"
                                  : "mint"
                            }
                          />
                        ) : null}
                        {line.carriedMinor > 0 ? (
                          <Text variant="caption" tone="mint">
                            +{" "}
                            <Amount
                              minor={line.carriedMinor}
                              variant="caption"
                              tone="mint"
                              animate={false}
                            />{" "}
                            rolled over
                          </Text>
                        ) : null}
                      </SwipeRowPressable>
                    </SwipeRow>
                  ))}
                </Card>
              </Section>
            );
          })
        }
      </AsyncContent>
    </Screen>
  );
}

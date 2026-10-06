import { useQueryClient } from "@tanstack/react-query";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { celebrate } from "@/components/ui/confetti";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { SkeletonCard } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { formatLocalDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useAccounts } from "@/lib/queries";
import { useRemove } from "@/lib/use-remove";
import { useGoals } from "./queries";

/** Savings jars with a target, an optional deadline and a suggested monthly amount. */
export function GoalsScreen() {
  const router = useRouter();
  const client = useQueryClient();
  const goals = useGoals();
  const remove = useRemove();
  const { data: accounts = [] } = useAccounts();
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<string | null>(null);

  const contribute = async (goalId: string) => {
    const amountMinor = parseAmountToMinor(amount);
    const jarAccountId = goals.data?.find((g) => g.id === goalId)?.accountId;
    // Never move money from the jar's own account into itself.
    const fromAccountId =
      from && from !== jarAccountId ? from : accounts.find((a) => a.id !== jarAccountId)?.id;
    if (!amountMinor || !fromAccountId) return;
    try {
      const result = await unwrap(
        api.goals[":id"].contribute.$post({
          param: { id: goalId },
          json: { id: newId(), amountMinor, fromAccountId },
        }),
      );
      if (result.justReached) {
        celebrate();
        notify(`${result.goal.emoji} ${result.goal.name} reached!`);
      } else notify("Added to the jar");
      setOpen(null);
      setAmount("");
      void client.invalidateQueries();
    } catch (error) {
      notify(friendlyError(error, "save"));
    }
  };

  return (
    <Screen
      title="Goals"
      tabBarPadding={false}
      right={<Button label="New" size="sm" icon="plus" onPress={() => router.push("/goal/new")} />}
    >
      <AsyncContent
        query={goals}
        skeleton={
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        }
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            title="No goals yet"
            message="Saving becomes a finishable project."
            actionLabel="Start a jar"
            onAction={() => router.push("/goal/new")}
          />
        }
      >
        {(data) =>
          data.map((goal) => {
            const edit = () => router.push(`/goal/${goal.id}`);
            return (
              <SwipeRow
                key={goal.id}
                actions={editDelete(edit, () => remove(`/goals/${goal.id}`, `“${goal.name}”`))}
              >
                <Card className="gap-2" onPress={edit}>
                  <View className="flex-row items-center gap-3">
                    <Text className="text-3xl">{goal.emoji}</Text>
                    <View className="flex-1">
                      <Text variant="strong">{goal.name}</Text>
                      <Text variant="caption" tone="muted">
                        <Amount
                          minor={goal.savedMinor}
                          variant="caption"
                          tone="mint"
                          animate={false}
                        />{" "}
                        of{" "}
                        <Amount
                          minor={goal.targetMinor}
                          variant="caption"
                          tone="muted"
                          animate={false}
                        />
                        {goal.deadline ? ` · by ${formatLocalDate(goal.deadline)}` : ""}
                      </Text>
                    </View>
                    {goal.reached ? <Text>🎉</Text> : null}
                  </View>
                  <ProgressBar value={goal.progress} tone="mint" />
                  {goal.suggestedMonthlyMinor ? (
                    <Text variant="caption" tone="muted">
                      Put aside{" "}
                      <Amount
                        minor={goal.suggestedMonthlyMinor}
                        variant="caption"
                        tone="ink"
                        animate={false}
                      />{" "}
                      a month to stay on pace.
                    </Text>
                  ) : null}
                  {open === goal.id ? (
                    <View className="gap-2">
                      <TextField
                        value={amount}
                        onChangeText={setAmount}
                        keyboardType="decimal-pad"
                        placeholder="Amount"
                        autoFocus
                      />
                      <View className="flex-row flex-wrap gap-2">
                        {accounts
                          .filter((a) => a.id !== goal.accountId)
                          .map((a) => (
                            <Chip
                              key={a.id}
                              label={a.name}
                              tone="mint"
                              choice="single"
                              selected={(from ?? accounts[0]?.id) === a.id}
                              onPress={() => setFrom(a.id)}
                            />
                          ))}
                      </View>
                      <Button
                        label="Move to jar"
                        variant="money"
                        onPress={() => contribute(goal.id)}
                      />
                    </View>
                  ) : (
                    !goal.reached && (
                      <Button
                        label="Add money"
                        size="sm"
                        variant="secondary"
                        onPress={() => setOpen(goal.id)}
                      />
                    )
                  )}
                </Card>
              </SwipeRow>
            );
          })
        }
      </AsyncContent>
    </Screen>
  );
}

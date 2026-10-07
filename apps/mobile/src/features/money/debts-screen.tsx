import { useQuery } from "@tanstack/react-query";
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
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonCard } from "@/components/ui/skeleton";
import { editDelete, SwipeRow, SwipeRowPressable } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { formatAmount, formatMonth, plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useAccounts } from "@/lib/queries";
import { useRemove } from "@/lib/use-remove";
import { useDebts } from "./queries";

type Debt = NonNullable<ReturnType<typeof useDebts>["data"]>[number];

function Forecast({ debt }: { debt: Debt }) {
  const [monthly, setMonthly] = useState("");
  const monthlyMinor = parseAmountToMinor(monthly) ?? 0;
  const forecast = useQuery({
    queryKey: ["debt-forecast", debt.id, monthlyMinor],
    queryFn: () =>
      unwrap(
        api.debts[":id"].forecast.$get({
          param: { id: debt.id },
          query: { monthly: String(monthlyMinor) },
        }),
      ),
    enabled: monthlyMinor > 0,
  });
  return (
    <View className="gap-1">
      <TextField
        value={monthly}
        onChangeText={setMonthly}
        keyboardType="decimal-pad"
        placeholder="Monthly payment for a forecast"
      />
      {forecast.data ? (
        <Text variant="caption" tone="sky">
          Cleared in {formatMonth(forecast.data.clearedIn)} ·{" "}
          {plural(forecast.data.months, "payment")}
        </Text>
      ) : null}
    </View>
  );
}

/** Who owes me and whom I owe, with partial repayments and a payoff forecast. */
export function DebtsScreen() {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const debts = useDebts();
  const { data: accounts = [] } = useAccounts();
  const [repaying, setRepaying] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const open = (debts.data ?? []).filter((d) => d.closedAt === null);
  const groups = [
    { title: "Owed to me", items: open.filter((d) => d.direction === "owed_to_me") },
    { title: "I owe", items: open.filter((d) => d.direction === "i_owe") },
  ];
  const repay = (debt: Debt) => {
    const amountMinor = parseAmountToMinor(amount);
    const account = accountId ?? accounts[0]?.id;
    if (!amountMinor || !account) return;
    send({
      method: "POST",
      path: `/debts/${debt.id}/repay`,
      body: { id: newId(), amountMinor, accountId: account },
      label: "Couldn't log the repayment",
    });
    notify(`Logged ${formatAmount(amountMinor)} from ${debt.person}`);
    setRepaying(null);
    setAmount("");
  };
  return (
    <Screen
      title="Debts"
      tabBarPadding={false}
      right={<Button label="New" size="sm" icon="plus" onPress={() => router.push("/debt/new")} />}
    >
      <AsyncContent
        query={debts}
        skeleton={
          <>
            <SkeletonCard lines={2} />
            <SkeletonCard lines={2} />
          </>
        }
        isEmpty={() => open.length === 0}
        empty={
          <EmptyState
            title="All square"
            message="No loans to track. Note one down so nobody has to remember."
            actionLabel="Add a loan"
            onAction={() => router.push("/debt/new")}
            mood="relaxed"
          />
        }
      >
        {() =>
          groups.map((group) =>
            group.items.length ? (
              <Section key={group.title} title={group.title}>
                {group.items.map((debt) => (
                  <SwipeRow
                    key={debt.id}
                    actions={editDelete(
                      () => router.push(`/debt/${debt.id}`),
                      () => remove(`/debts/${debt.id}`, `“${debt.person}”`),
                    )}
                  >
                    <Card className="gap-2">
                      {/* Only the summary opens the loan; the forecast and repayment below stay inline. */}
                      <SwipeRowPressable
                        onPress={() => router.push(`/debt/${debt.id}`)}
                        className="gap-2 active:opacity-80"
                        accessibilityHint="Opens the loan. Delete is in the actions menu"
                      >
                        <View className="flex-row items-center justify-between">
                          <Text variant="strong">{debt.person}</Text>
                          <Amount
                            minor={debt.outstandingMinor}
                            currency={debt.currency}
                            variant="heading"
                            tone={debt.direction === "owed_to_me" ? "mint" : "coral"}
                          />
                        </View>
                        <ProgressBar value={debt.repaidMinor / debt.principalMinor} tone="ink" />
                        <Text variant="caption" tone="muted">
                          {formatAmount(debt.repaidMinor, { currency: debt.currency })} of{" "}
                          {formatAmount(debt.principalMinor, { currency: debt.currency })} repaid
                          {debt.note ? ` · ${debt.note}` : ""}
                        </Text>
                      </SwipeRowPressable>
                      <Forecast debt={debt} />
                      {repaying === debt.id ? (
                        <View className="gap-2">
                          <TextField
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="decimal-pad"
                            placeholder="Amount repaid"
                            autoFocus
                          />
                          <View
                            accessibilityRole="radiogroup"
                            accessibilityLabel="Account"
                            className="flex-row flex-wrap gap-2"
                          >
                            {accounts.map((a) => (
                              <Chip
                                key={a.id}
                                label={a.name}
                                tone="mint"
                                choice="single"
                                selected={(accountId ?? accounts[0]?.id) === a.id}
                                onPress={() => setAccountId(a.id)}
                              />
                            ))}
                          </View>
                          <Button label="Log repayment" onPress={() => repay(debt)} />
                        </View>
                      ) : (
                        <Button
                          label="Log a repayment"
                          size="sm"
                          variant="secondary"
                          onPress={() => setRepaying(debt.id)}
                        />
                      )}
                    </Card>
                  </SwipeRow>
                ))}
              </Section>
            ) : null,
          )
        }
      </AsyncContent>
    </Screen>
  );
}

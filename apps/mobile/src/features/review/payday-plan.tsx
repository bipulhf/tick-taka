import { toLocalMonth } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { formatAmount, parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useBudgets, useGoals } from "@/features/money/queries";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useSettings } from "@/lib/queries";

/** Payday plan: split the salary across rent, bills, family, jars and flexible spending until ৳0 is left. */
export function PaydayPlan() {
  const router = useRouter();
  const send = useOutbox();
  const month = toLocalMonth(Date.now());
  const budgets = useBudgets(month);
  const goals = useGoals();
  const { data: settings } = useSettings();
  const [salary, setSalary] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const lines = (budgets.data?.lines ?? []).filter((l) => l.parentId === null);
  const jars = (goals.data ?? []).filter((g) => !g.reached);

  useEffect(() => {
    if (!budgets.data) return;
    setAmounts((current) => {
      const next = { ...current };
      for (const line of budgets.data.lines)
        if (line.hasBudget && next[line.categoryId] === undefined)
          next[line.categoryId] = String(toMajor(line.limitMinor));
      for (const goal of goals.data ?? [])
        if (goal.suggestedMonthlyMinor && next[`goal:${goal.id}`] === undefined)
          next[`goal:${goal.id}`] = String(toMajor(goal.suggestedMonthlyMinor));
      return next;
    });
  }, [budgets.data, goals.data]);

  const salaryMinor = parseAmountToMinor(salary || "0") ?? 0;
  const assigned = Object.values(amounts).reduce(
    (sum, v) => sum + (parseAmountToMinor(v || "0") ?? 0),
    0,
  );
  const left = salaryMinor - assigned;

  const save = () => {
    const budgetLines = lines
      .map((line) => ({
        categoryId: line.categoryId,
        limitMinor: parseAmountToMinor(amounts[line.categoryId] || "0") ?? 0,
        rollover: line.rollover,
      }))
      .filter((l) => l.limitMinor > 0);
    send({
      method: "PUT",
      path: "/budgets",
      body: { month, budgets: budgetLines },
      label: "Couldn't save the plan",
    });
    const from = settings?.defaultAccountId;
    for (const goal of jars) {
      const amountMinor = parseAmountToMinor(amounts[`goal:${goal.id}`] || "0") ?? 0;
      if (amountMinor > 0 && from && from !== goal.accountId) {
        send({
          method: "POST",
          path: `/goals/${goal.id}/contribute`,
          body: { id: newId(), amountMinor, fromAccountId: from },
          label: `Couldn't fill ${goal.name}`,
        });
      }
    }
    notify("Every taka has a job.");
    router.back();
  };

  const row = (key: string, label: string) => (
    <View key={key} className="flex-row items-center gap-3">
      <Text className="flex-1">{label}</Text>
      <TextField
        value={amounts[key] ?? ""}
        onChangeText={(v) => setAmounts((a) => ({ ...a, [key]: v }))}
        keyboardType="decimal-pad"
        placeholder="0"
        accessibilityLabel={label}
        className="w-28"
      />
    </View>
  );

  return (
    <Screen title="Payday plan" subtitle="Give every taka a job" tabBarPadding={false}>
      <TextField
        label="Salary that landed"
        value={salary}
        onChangeText={setSalary}
        keyboardType="decimal-pad"
        placeholder="45000"
        autoFocus
      />
      <Card className={left === 0 && salaryMinor > 0 ? "bg-mint/15" : ""}>
        <Text variant="label" tone="muted">
          Left to assign
        </Text>
        <Text variant="title" tone={left < 0 ? "coral" : left === 0 ? "mint" : "ink"} numeric>
          {formatAmount(left)}
        </Text>
      </Card>
      <AsyncContent
        query={budgets}
        skeleton={<SkeletonList rows={4} leading="none" trailing />}
        isEmpty={() => lines.length === 0}
        empty={
          <EmptyState
            title="No categories yet"
            message="Add a few spending categories to split your salary across them."
            actionLabel="Add categories"
            onAction={() => router.push("/settings/areas")}
          />
        }
      >
        {() => (
          <>
            <Section title="Fixed">
              <Card className="gap-2">
                {lines
                  .filter((l) => l.budgetType === "fixed")
                  .map((l) => row(l.categoryId, `${l.emoji} ${l.name}`))}
              </Card>
            </Section>
            <Section title="Non-monthly set-asides">
              <Card className="gap-2">
                {lines
                  .filter((l) => l.budgetType === "non_monthly")
                  .map((l) => row(l.categoryId, `${l.emoji} ${l.name}`))}
              </Card>
            </Section>
            {jars.length ? (
              <Section title="Savings jars">
                <Card className="gap-2">
                  {jars.map((g) => row(`goal:${g.id}`, `${g.emoji} ${g.name}`))}
                </Card>
              </Section>
            ) : null}
            <Section title="Flexible">
              <Card className="gap-2">
                {lines
                  .filter((l) => l.budgetType === "flexible")
                  .map((l) => row(l.categoryId, `${l.emoji} ${l.name}`))}
              </Card>
            </Section>
          </>
        )}
      </AsyncContent>
      <Button
        label={left === 0 ? "Save plan" : `Save with ${formatAmount(left)} unassigned`}
        onPress={save}
        disabled={salaryMinor === 0}
      />
    </Screen>
  );
}

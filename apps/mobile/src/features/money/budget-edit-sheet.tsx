import { formatAmount, parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatMonth } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { useColors } from "@/theme/colors";
import { useBudgets } from "./queries";

interface Line {
  limit: string;
  rollover: boolean;
}

/** Set next month's limits per category; spending decisions happen before the month. */
export function BudgetEditSheet({
  month,
  suggested,
}: {
  month: string;
  suggested?: Record<string, number>;
}) {
  const router = useRouter();
  const send = useOutbox();
  const colors = useColors();
  const budgets = useBudgets(month);
  const [lines, setLines] = useState<Record<string, Line>>({});
  useEffect(() => {
    if (!budgets.data) return;
    const next: Record<string, Line> = {};
    for (const line of budgets.data.lines) {
      const limit = suggested?.[line.categoryId] ?? (line.hasBudget ? line.limitMinor : 0);
      next[line.categoryId] = {
        limit: limit ? String(toMajor(limit)) : "",
        rollover: line.rollover,
      };
    }
    setLines(next);
  }, [budgets.data, suggested]);
  const parents = (budgets.data?.lines ?? []).filter((l) => l.parentId === null);
  const save = () => {
    const payload = Object.entries(lines)
      .map(([categoryId, line]) => ({
        categoryId,
        limitMinor: parseAmountToMinor(line.limit || "0") ?? 0,
        rollover: line.rollover,
      }))
      .filter((line) => line.limitMinor > 0);
    send({
      method: "PUT",
      path: "/budgets",
      body: { month, budgets: payload },
      label: "Couldn't save budgets",
    });
    router.back();
  };
  const total = Object.values(lines).reduce(
    (sum, l) => sum + (parseAmountToMinor(l.limit || "0") ?? 0),
    0,
  );
  return (
    <Sheet
      title={`Budgets · ${formatMonth(month)}`}
      footer={
        // Saving before the budgets load would replace them with an empty set.
        <Button label={`Save ${formatAmount(total)}`} onPress={save} disabled={!budgets.data} />
      }
    >
      {budgets.data === undefined ? (
        <SkeletonForm fields={5} />
      ) : (
        parents.map((line) => (
          <View key={line.categoryId} className="flex-row items-center gap-3">
            <Text className="flex-1">
              {line.emoji} {line.name}
              <Text variant="caption" tone="muted">{`  ${line.budgetType.replace("_", "-")}`}</Text>
            </Text>
            <TextField
              value={lines[line.categoryId]?.limit ?? ""}
              onChangeText={(limit) =>
                setLines((l) => ({
                  ...l,
                  [line.categoryId]: { rollover: l[line.categoryId]?.rollover ?? false, limit },
                }))
              }
              keyboardType="decimal-pad"
              placeholder="0"
              accessibilityLabel={`${line.name} limit`}
              className="w-28"
            />
            <Switch
              value={lines[line.categoryId]?.rollover ?? false}
              onValueChange={(rollover) =>
                setLines((l) => ({
                  ...l,
                  [line.categoryId]: { limit: l[line.categoryId]?.limit ?? "", rollover },
                }))
              }
              trackColor={{ true: colors.mint, false: colors.lineStrong }}
              accessibilityLabel={`Roll over unspent ${line.name}`}
            />
          </View>
        ))
      )}
      <Text variant="caption" tone="muted">
        The switch rolls unspent money into next month.
      </Text>
    </Sheet>
  );
}

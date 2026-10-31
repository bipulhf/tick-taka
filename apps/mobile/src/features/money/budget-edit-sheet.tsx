import { useMutation } from "@tanstack/react-query";
import { parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { Toggle } from "@/components/ui/toggle-row";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { formatAmount, formatMonth } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useAiStatus } from "@/lib/queries";
import { useBudgetSuggestion, useBudgets } from "./queries";

interface Line {
  limit: string;
  rollover: boolean;
}

/**
 * Set a month's limits per category; spending decisions happen before the month.
 * `plan` is "Plan next month": it starts from the last three months' average and
 * offers "Refine with Tiki" when AI is on.
 */
export function BudgetEditSheet({
  month,
  suggested: given,
  plan = false,
}: {
  month: string;
  suggested?: Record<string, number>;
  plan?: boolean;
}) {
  const router = useRouter();
  const send = useOutbox();
  const budgets = useBudgets(month);
  const suggestion = useBudgetSuggestion(month, { enabled: plan });
  // One object per answer, so typed limits aren't refilled on every render.
  const suggested = useMemo(
    () =>
      plan && suggestion.data
        ? Object.fromEntries(suggestion.data.budgets.map((b) => [b.categoryId, b.limitMinor]))
        : given,
    [plan, suggestion.data, given],
  );
  const [lines, setLines] = useState<Record<string, Line>>({});
  const ai = useAiStatus();
  const refine = useMutation({
    mutationFn: () => unwrap(api.ai["budget-suggestions"].$post({ json: { month } })),
    onSuccess: (result) => {
      setLines((all) => {
        const next = { ...all };
        for (const b of result.budgets)
          next[b.categoryId] = {
            rollover: all[b.categoryId]?.rollover ?? false,
            limit: String(toMajor(b.limitMinor)),
          };
        return next;
      });
      notify("Tiki filled in its suggestions. Check them before saving.");
    },
    onError: (error) => notify(friendlyError(error)),
  });
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
  const loading = budgets.data === undefined || (plan && suggestion.isPending);
  return (
    <Sheet
      title={plan ? `Plan ${formatMonth(month)}` : `Budgets · ${formatMonth(month)}`}
      footer={
        // Saving before the budgets load would replace them with an empty set.
        <Button label={`Save ${formatAmount(total)}`} onPress={save} disabled={loading} />
      }
    >
      {plan ? (
        <Text tone="muted">
          {suggestion.data && suggestion.data.budgets.length === 0
            ? "Nothing to suggest yet. A few months of spending gives this a starting point."
            : "Started from the average of the last three months. Change anything you like."}
        </Text>
      ) : null}
      {plan && ai.data?.configured && ai.data.features.budgetSuggestions ? (
        <Button
          label="Refine with Tiki"
          variant="secondary"
          icon="auto-fix"
          loading={refine.isPending}
          onPress={() => refine.mutate()}
        />
      ) : null}
      {loading ? (
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
            <Toggle
              value={lines[line.categoryId]?.rollover ?? false}
              onChange={(rollover) =>
                setLines((l) => ({
                  ...l,
                  [line.categoryId]: { limit: l[line.categoryId]?.limit ?? "", rollover },
                }))
              }
              label={`Roll over unspent ${line.name}`}
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

import { useQueryClient } from "@tanstack/react-query";
import { monthOf } from "@tick-taka/shared/dates";
import { toBanglaDigits } from "@tick-taka/shared/digits";
import { firstBudgetCategory, withFirstBudget } from "@tick-taka/shared/first-budget";
import { currencySymbol, parseAmountToMinor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatAmount, numeralsStore } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { type TodayData, useCategories, useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { updateToday } from "@/lib/today-cache";

/**
 * The safe-to-spend card before any flexible budget exists: one question and one
 * amount. Saving sets this month's first budget (see shared/first-budget.ts) through
 * the outbox, and the card turns into today's number straight away, offline too.
 */
export function FirstBudget({ data }: { data: TodayData }) {
  const router = useRouter();
  const client = useQueryClient();
  const send = useOutbox();
  const { data: categories } = useCategories();
  const { data: settings } = useSettings();
  const bangla = useStore(numeralsStore) === "beng";
  const [text, setText] = useState("");
  const currency = settings?.defaultCurrency ?? "BDT";
  const parsed = text.trim() ? parseAmountToMinor(text, currency) : null;
  const limitMinor = parsed !== null && parsed > 0 ? parsed : null;
  const categoryId = categories ? firstBudgetCategory(categories) : null;
  const month = monthOf(data.date);

  const save = () => {
    if (!limitMinor || !categoryId) return;
    send({
      method: "PUT",
      path: `/budgets/${month}/${categoryId}`,
      body: { limitMinor },
      label: "Couldn't save the budget",
    });
    updateToday(client, (today) =>
      monthOf(today.date) === month
        ? { ...today, safeToSpend: withFirstBudget(today.safeToSpend, limitMinor, today.date) }
        : today,
    );
  };

  return (
    <Card className="gap-3">
      <Text variant="callout" tone="muted">
        Safe to spend today
      </Text>
      <Text variant="strong">Spending money this month</Text>
      <View className="flex-row items-start gap-2">
        <TextField
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder={`${currencySymbol(currency).trim()} ${bangla ? toBanglaDigits("0") : "0"}`}
          accessibilityLabel="Spending money this month"
          returnKeyType="done"
          onSubmitEditing={save}
          className="flex-1"
        />
        <Button
          label={limitMinor ? `Save ${formatAmount(limitMinor, { currency })}` : "Save"}
          variant="secondary"
          onPress={save}
          disabled={!limitMinor || !categoryId}
        />
      </View>
      <Text variant="caption" tone="muted">
        Day-to-day spending, not rent or bills.
      </Text>
      <Pressable
        onPress={() => router.push("/money/budgets")}
        accessibilityRole="link"
        className="min-h-12 justify-center self-start"
      >
        <Text variant="callout" tone="sky" className="font-nunito-bold">
          Set budgets by category
        </Text>
      </Pressable>
    </Card>
  );
}

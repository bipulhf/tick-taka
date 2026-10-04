import type { QuickAddKind } from "@tick-taka/shared/quick-add";
import { describeDraft } from "@tick-taka/shared/quick-add";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { formatAmount, formatWhen } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useColors } from "@/theme/colors";
import { type DayChoice, useQuickAdd } from "./use-quick-add";

const KINDS: { value: QuickAddKind | null; label: string }[] = [
  { value: null, label: "Auto" },
  { value: "task", label: "Task" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "time_entry", label: "Time" },
];

const DAYS: { value: DayChoice; label: string }[] = [
  { value: "inbox", label: "Inbox" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "evening", label: "Evening" },
  { value: "someday", label: "Someday" },
];

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2"
    >
      {children}
    </ScrollView>
  );
}

/** One text field, one Save button. Type chips override what the parser guessed. */
export function QuickAddSheet({
  initialText,
  initialKind,
}: {
  initialText?: string;
  initialKind?: QuickAddKind | null;
}) {
  const router = useRouter();
  const colors = useColors();
  const send = useOutbox();
  const qa = useQuickAdd(initialText, initialKind ?? null);
  const { draft, reference } = qa;

  const names = {
    account:
      draft && "accountId" in draft
        ? reference.accounts.find((a) => a.id === draft.accountId)?.name
        : null,
    category:
      draft && "categoryId" in draft
        ? reference.categories.find((c) => c.id === draft.categoryId)?.name
        : null,
    area:
      draft && "areaId" in draft ? reference.areas.find((a) => a.id === draft.areaId)?.name : null,
  };
  const preview =
    draft && draft.kind !== "transfer"
      ? describeDraft(
          draft,
          names,
          (m) => formatAmount(m),
          (ms, hasTime) => formatWhen(ms, hasTime, Date.now(), qa.timeZone),
        )
      : draft?.kind === "transfer"
        ? `Transfer ${draft.amountMinor === null ? "—" : formatAmount(draft.amountMinor)}`
        : "Type a task, an expense like “lunch 250”, “+45000 salary” or “2h thesis”.";
  const requests = qa.buildRequests();

  const save = () => {
    if (!requests) return;
    for (const request of requests) send(request);
    haptic.success();
    notify("Saved");
    router.back();
  };

  const moneyKind = draft?.kind === "expense" || draft?.kind === "income" ? draft.kind : null;
  const categories = reference.categories.filter((c) => c.kind === (moneyKind ?? "expense"));

  return (
    <Sheet
      title="Quick add"
      footer={<Button label="Save" onPress={save} disabled={!requests} icon="check" />}
    >
      <ChipRow>
        {KINDS.map((option) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={qa.kind === option.value}
            onPress={() => qa.setKind(option.value)}
          />
        ))}
      </ChipRow>
      <TextInput
        value={qa.text}
        onChangeText={qa.setText}
        autoFocus
        placeholder="lunch 250"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="What to add"
        className="min-h-14 rounded-2xl border border-line bg-card px-4 font-nunito-bold text-xl text-ink"
      />
      <View className="min-h-6 flex-row items-center gap-2">
        {qa.aiBusy ? <ActivityIndicator size="small" color={colors.mango} /> : null}
        <Text tone={draft ? "ink" : "muted"} className="flex-1" accessibilityLiveRegion="polite">
          {qa.aiUsed ? "✨ " : ""}
          {preview}
        </Text>
      </View>
      {qa.hoursOfWork ? (
        <Text variant="caption" tone="muted">
          ≈ {qa.hoursOfWork} hours of work
        </Text>
      ) : null}

      {moneyKind ? (
        <>
          <Text variant="label" tone="muted">
            Account
          </Text>
          <ChipRow>
            {reference.accounts.map((account) => (
              <Chip
                key={account.id}
                label={account.name}
                tone="mint"
                selected={draft && "accountId" in draft ? draft.accountId === account.id : false}
                onPress={() => qa.setOverrides({ ...qa.overrides, accountId: account.id })}
              />
            ))}
          </ChipRow>
          <Text variant="label" tone="muted">
            Category
          </Text>
          <ChipRow>
            {categories.map((category) => (
              <Chip
                key={category.id}
                label={`${category.emoji} ${category.name}`}
                tone={moneyKind === "income" ? "mint" : "coral"}
                selected={draft && "categoryId" in draft ? draft.categoryId === category.id : false}
                onPress={() => qa.setOverrides({ ...qa.overrides, categoryId: category.id })}
              />
            ))}
          </ChipRow>
        </>
      ) : null}

      {draft?.kind === "task" ? (
        <>
          <Text variant="label" tone="muted">
            When
          </Text>
          <ChipRow>
            {DAYS.map((day) => (
              <Chip
                key={day.value}
                label={day.label}
                tone="sky"
                selected={qa.overrides.day === day.value}
                onPress={() => qa.setOverrides({ ...qa.overrides, day: day.value })}
              />
            ))}
          </ChipRow>
        </>
      ) : null}

      {draft && draft.kind !== "transfer" ? (
        <>
          <Text variant="label" tone="muted">
            Area
          </Text>
          <ChipRow>
            {reference.areas.map((area) => (
              <Chip
                key={area.id}
                label={`${area.emoji} ${area.name}`}
                tone="sky"
                selected={"areaId" in draft && draft.areaId === area.id}
                onPress={() => qa.setOverrides({ ...qa.overrides, areaId: area.id })}
              />
            ))}
          </ChipRow>
        </>
      ) : null}
      {moneyKind && reference.accounts.length === 0 ? (
        <Button
          label="Add your first account"
          variant="secondary"
          onPress={() => router.replace("/money/accounts")}
        />
      ) : null}
    </Sheet>
  );
}

import type { QuickAddKind } from "@tick-taka/shared/quick-add";
import { describeDraft } from "@tick-taka/shared/quick-add";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon, type IconName } from "@/components/ui/icon";
import { PickerField } from "@/components/ui/picker-field";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { formatAmount, formatWhen } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { playSound } from "@/lib/sounds";
import type { ColorName } from "@/theme/colors";
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
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "evening", label: "Evening" },
  { value: "inbox", label: "Inbox" },
  { value: "someday", label: "Someday" },
];

const KIND_LOOK: Record<string, { icon: IconName; color: ColorName }> = {
  expense: { icon: "arrow-top-right", color: "coral" },
  income: { icon: "arrow-bottom-left", color: "mint" },
  transfer: { icon: "swap-horizontal", color: "sky" },
  task: { icon: "checkbox-blank-circle-outline", color: "sky" },
  time_entry: { icon: "timer-outline", color: "sky" },
};

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

/** One text field, one Save button. Choices appear only when the parser needs help. */
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
  const [moreOpen, setMoreOpen] = useState(false);
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
        : null;
  const requests = qa.buildRequests();

  const save = () => {
    if (!requests) return;
    for (const request of requests) send(request);
    haptic.success();
    playSound("pop");
    notify("Saved");
    router.back();
  };

  const moneyKind = draft?.kind === "expense" || draft?.kind === "income" ? draft.kind : null;
  const look = draft ? KIND_LOOK[draft.kind] : null;
  const areaOptions = reference.areas.map((a) => ({ id: a.id, label: a.name, emoji: a.emoji }));
  const areaId = draft && "areaId" in draft ? draft.areaId : null;

  return (
    <Sheet
      title="Add"
      footer={<Button label="Save" onPress={save} disabled={!requests} icon="check" />}
    >
      <TextInput
        value={qa.text}
        onChangeText={qa.setText}
        autoFocus
        placeholder="lunch 250 · call bank tomorrow 5pm"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        onSubmitEditing={save}
        accessibilityLabel="What to add"
        autoCapitalize="none"
        multiline
        blurOnSubmit
        className="min-h-16 font-nunito-bold text-2xl leading-8 text-ink"
      />

      <View
        className="min-h-16 flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3"
        accessibilityLiveRegion="polite"
      >
        {qa.aiBusy ? (
          <ActivityIndicator color={colors.mango} />
        ) : look ? (
          <View className="h-9 w-9 items-center justify-center rounded-full bg-background">
            <Icon name={look.icon} size={20} color={look.color} />
          </View>
        ) : null}
        <Text
          variant={preview ? "strong" : "callout"}
          tone={preview ? "ink" : "muted"}
          className="flex-1"
        >
          {preview
            ? `${qa.aiUsed ? "✨ " : ""}${preview}`
            : "Type a task, an expense, “+45000 salary” or “2h thesis”."}
        </Text>
      </View>
      {qa.hoursOfWork ? (
        <Text variant="callout" tone="muted" className="-mt-2 px-1">
          ≈ {qa.hoursOfWork} {qa.hoursOfWork === 1 ? "hour" : "hours"} of work
        </Text>
      ) : null}

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

      {moneyKind ? (
        <View className="flex-row gap-3">
          <PickerField
            label="Account"
            value={draft && "accountId" in draft ? draft.accountId : null}
            options={reference.accounts.map((a) => ({ id: a.id, label: a.name }))}
            onChange={(id) => qa.setOverrides({ ...qa.overrides, accountId: id })}
          />
          <PickerField
            label="Category"
            value={draft && "categoryId" in draft ? draft.categoryId : null}
            options={reference.categories
              .filter((c) => c.kind === moneyKind)
              .map((c) => ({ id: c.id, label: c.name, emoji: c.emoji }))}
            onChange={(id) => qa.setOverrides({ ...qa.overrides, categoryId: id })}
          />
        </View>
      ) : null}

      {draft?.kind === "task" ? (
        <ChipRow>
          {DAYS.map((day) => (
            <Chip
              key={day.value}
              label={day.label}
              selected={qa.overrides.day === day.value}
              onPress={() => qa.setOverrides({ ...qa.overrides, day: day.value })}
            />
          ))}
        </ChipRow>
      ) : null}

      {draft && draft.kind !== "transfer" ? (
        moreOpen || draft.kind === "time_entry" ? (
          <View className="flex-row">
            <PickerField
              label="Area"
              value={areaId}
              options={areaOptions}
              placeholder="No area"
              onChange={(id) => qa.setOverrides({ ...qa.overrides, areaId: id })}
            />
          </View>
        ) : (
          <Pressable
            onPress={() => setMoreOpen(true)}
            accessibilityRole="button"
            className="min-h-12 flex-row items-center gap-2 self-start px-1"
          >
            <Icon name="tune-variant" size={20} color="muted" />
            <Text variant="callout" tone="muted">
              {names.area ? `Area: ${names.area}` : "More options"}
            </Text>
          </Pressable>
        )
      ) : null}

      {moneyKind && reference.accountsLoaded && reference.accounts.length === 0 ? (
        <Button
          label="Add your first account"
          variant="secondary"
          onPress={() => router.replace("/account/new")}
        />
      ) : null}
    </Sheet>
  );
}

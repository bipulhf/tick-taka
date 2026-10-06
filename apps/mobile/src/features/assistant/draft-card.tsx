import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatWhen } from "@/lib/format";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import { type ChatDraft, draftView } from "./money-drafts";

/**
 * A money change Tiki proposed: amount with its sign, account, category and date,
 * with Save and Discard. Nothing is written until Save.
 */
export function DraftCard({
  draft,
  onSave,
  onDiscard,
}: {
  draft: ChatDraft;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const view = draftView(draft, { accounts, categories });
  const details = [
    view.account,
    view.category,
    view.date ? formatWhen(view.date, true, Date.now(), userTime(settings).timeZone) : null,
  ].filter(Boolean);

  if (draft.state === "discarded")
    return (
      <Text variant="caption" tone="muted" className="px-1">
        Discarded: {view.title}. Nothing was saved.
      </Text>
    );
  // Once saved it shows in the list of changes above, with its Undo.
  if (draft.state === "saved") return null;
  return (
    <View className="w-full gap-3 rounded-2xl border border-line-strong bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="cash-clock" size={20} color="muted" />
        <Text variant="callout" tone="muted" className="flex-1" numberOfLines={2}>
          {view.title} · not saved yet
        </Text>
      </View>
      {view.amountMinor !== null ? (
        <Amount
          minor={view.amountMinor}
          signed={view.signed}
          variant="title"
          tone={view.signed ? (view.amountMinor < 0 ? "coral" : "mint") : "ink"}
          animate={false}
        />
      ) : null}
      {details.length ? (
        <Text variant="callout" numberOfLines={2}>
          {details.join(" · ")}
        </Text>
      ) : null}
      <View className="flex-row gap-2">
        <Pressable
          onPress={onDiscard}
          accessibilityRole="button"
          accessibilityLabel={`Discard: ${view.title}`}
          className="min-h-12 flex-1 items-center justify-center rounded-full border border-line-strong active:bg-line/40"
        >
          <Text variant="callout" className="font-nunito-bold">
            Discard
          </Text>
        </Pressable>
        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          accessibilityLabel={`Save: ${view.title}`}
          className="min-h-12 flex-1 items-center justify-center rounded-full bg-mango active:opacity-80"
        >
          <Text variant="callout" tone="onAccent" className="font-nunito-bold">
            Save
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

import type { AssistantCard, AssistantRecordKind } from "@tick-taka/shared/schemas/ai";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { formatMinutes } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import type { ColorName } from "@/theme/colors";
import { recordHref } from "./assistant-screen";

type RecordCard = Extract<AssistantCard, { type: "record" }>;
type TotalCard = Extract<AssistantCard, { type: "total" }>;

/** How each kind of record is drawn and named: time is sky, habits grape, money neutral. */
const KINDS: Record<AssistantRecordKind, { icon: IconName; color: ColorName; noun: string }> = {
  task: { icon: "checkbox-blank-circle-outline", color: "sky", noun: "task" },
  transaction: { icon: "swap-vertical", color: "muted", noun: "transaction" },
  habit: { icon: "repeat", color: "grape", noun: "habit" },
  goal: { icon: "piggy-bank-outline", color: "muted", noun: "goal" },
  debt: { icon: "handshake-outline", color: "muted", noun: "debt" },
  account: { icon: "wallet-outline", color: "muted", noun: "account" },
  event: { icon: "calendar-star", color: "muted", noun: "event" },
  project: { icon: "folder-outline", color: "sky", noun: "project" },
  recurring: { icon: "calendar-sync", color: "muted", noun: "bill" },
  time_entry: { icon: "timer-outline", color: "sky", noun: "time entry" },
  routine: { icon: "format-list-checks", color: "sky", noun: "routine" },
};

/** What a record kind is called in words ("Asking about this bill"). */
export const recordNoun = (kind: AssistantRecordKind) => KINDS[kind].noun;

/** Records Tiki named or changed, one compact row each, opening that record's sheet. */
function RecordRows({ cards }: { cards: RecordCard[] }) {
  const router = useRouter();
  return (
    <View className="w-full rounded-2xl border border-line px-3">
      {cards.map((card, index) => {
        const kind = KINDS[card.kind];
        return (
          <Pressable
            key={`${card.kind}-${card.id}`}
            onPress={() => {
              haptic.tap();
              router.push(recordHref(card.kind, card.id));
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${kind.noun} ${card.title}${card.subtitle ? `, ${card.subtitle}` : ""}`}
            className={`min-h-12 flex-row items-center gap-2.5 py-2 active:opacity-70 ${index > 0 ? "border-t border-line" : ""}`}
          >
            <Icon name={kind.icon} size={18} color={kind.color} />
            <View className="flex-1">
              <Text variant="callout" className="font-nunito-bold" numberOfLines={1}>
                {card.title}
              </Text>
              {card.subtitle ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>
                  {card.subtitle}
                </Text>
              ) : null}
            </View>
            <Icon name="chevron-right" size={20} color="muted" />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A total from a report: its label over one compact number. */
function TotalTile({ card }: { card: TotalCard }) {
  return (
    <View className="min-w-[45%] flex-1 gap-0.5 rounded-2xl bg-card px-4 py-3">
      <Text variant="caption" tone="muted" numberOfLines={2}>
        {card.label}
      </Text>
      {card.amountMinor !== undefined ? (
        <Amount minor={card.amountMinor} variant="heading" animate={false} />
      ) : (
        <Text variant="heading" numeric>
          {card.minutes !== undefined ? formatMinutes(card.minutes) : String(card.count ?? 0)}
        </Text>
      )}
    </View>
  );
}

/** Totals first (they are part of the answer), then the records to open. */
export function MessageCards({ cards }: { cards: AssistantCard[] }) {
  const totals = cards.filter((card): card is TotalCard => card.type === "total");
  const records = cards.filter((card): card is RecordCard => card.type === "record");
  return (
    <>
      {totals.length ? (
        <View className="w-full flex-row flex-wrap gap-2">
          {totals.map((card) => (
            <TotalTile key={card.label} card={card} />
          ))}
        </View>
      ) : null}
      {records.length ? <RecordRows cards={records} /> : null}
    </>
  );
}

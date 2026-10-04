import { formatAmount } from "@tick-taka/shared/money";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { formatWhen } from "@/lib/format";
import { useAccounts, useCategories } from "@/lib/queries";
import { type SmsCard, updateCard, useSmsCards } from "./sms-store";
import { type Mismatch, useSmsActions } from "./use-sms-actions";

const KIND_LABEL = { expense: "Expense", income: "Income", transfer: "Transfer" } as const;

function CardView({
  card,
  accountName,
  categories,
  onAdd,
  onIgnore,
  onEdit,
}: {
  card: SmsCard;
  accountName: string;
  categories: { id: string; name: string; emoji: string; kind: string }[];
  onAdd: () => void;
  onIgnore: () => void;
  onEdit: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const category = categories.find((c) => c.id === card.categoryId);
  const out = card.kind !== "income";
  return (
    <SwipeRow
      right={{ icon: "check-bold", className: "bg-mint", onTrigger: onAdd }}
      left={{ icon: "eye-off-outline", className: "bg-muted", onTrigger: onIgnore }}
    >
      <Card className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text variant="caption" tone="muted">
            {card.kind === "transfer" ? accountName : `${card.sender} → ${accountName}`}
            {card.aiParsed ? " · ✨ AI read" : ""}
          </Text>
          <Text variant="caption" tone="muted">
            {formatWhen(card.receivedAt, true)}
          </Text>
        </View>
        <Amount
          minor={card.parsed.amountMinor}
          variant="display"
          tone={out ? "coral" : "mint"}
          signed={!out}
          animate={false}
        />
        {card.parsed.feeMinor > 0 ? (
          <Text variant="caption" tone="muted">
            Fee {formatAmount(card.parsed.feeMinor)}
          </Text>
        ) : null}
        <View className="flex-row flex-wrap gap-2">
          <Chip label={KIND_LABEL[card.kind]} selected tone={out ? "coral" : "mint"} />
          {card.kind !== "transfer" ? (
            <Chip
              label={category ? `${category.emoji} ${category.name}` : "Pick category"}
              onPress={() => setPicking(!picking)}
            />
          ) : null}
        </View>
        {picking ? (
          <View className="flex-row flex-wrap gap-2">
            {categories
              .filter((c) => c.kind === (card.kind === "income" ? "income" : "expense"))
              .map((c) => (
                <Chip
                  key={c.id}
                  label={`${c.emoji} ${c.name}`}
                  tone={card.kind === "income" ? "mint" : "coral"}
                  selected={card.categoryId === c.id}
                  onPress={() => {
                    updateCard(card.fingerprint, { categoryId: c.id, confident: true });
                    setPicking(false);
                  }}
                />
              ))}
          </View>
        ) : null}
        <Text numberOfLines={1}>{card.note}</Text>
        <View className="flex-row gap-2">
          <Button label="Ignore" size="sm" variant="ghost" onPress={onIgnore} />
          <Button label="Edit" size="sm" variant="secondary" onPress={onEdit} className="flex-1" />
          <Button label="Add" size="sm" onPress={onAdd} className="flex-1" />
        </View>
      </Card>
    </SwipeRow>
  );
}

/** SMS review panel: nothing is saved until Add, so a wrong parse never pollutes the numbers. */
export function SmsReviewPanel() {
  const router = useRouter();
  const params = useLocalSearchParams<{ action?: string; receivedAt?: string }>();
  const cards = useSmsCards();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const [mismatch, setMismatch] = useState<Mismatch | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const initialCategories = useRef(new Map<string, string | null>());
  const balances = new Map(accounts.map((a) => [a.id, a.balanceMinor]));
  const actions = useSmsActions(balances, setMismatch);
  const pending = cards.filter((c) => c.status === "pending");
  const ignored = cards.filter((c) => c.status === "ignored");
  for (const card of pending)
    if (!initialCategories.current.has(card.fingerprint))
      initialCategories.current.set(card.fingerprint, card.categoryId);
  const add = (card: SmsCard) =>
    actions.add(card, initialCategories.current.get(card.fingerprint) ?? null);

  // "Add" from the notification adds the matching card straight away, once.
  const handledLink = useRef(false);
  const addRef = useRef(add);
  addRef.current = add;
  useEffect(() => {
    if (handledLink.current || params.action !== "add" || !params.receivedAt) return;
    const target = pending.find(
      (c) => Math.abs(c.receivedAt - Number(params.receivedAt)) < 120_000,
    );
    if (!target) return;
    handledLink.current = true;
    if (target.confident) addRef.current(target);
  }, [params.action, params.receivedAt, pending]);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Account";
  const allConfident = pending.length > 1 && pending.every((c) => c.confident);

  return (
    <Sheet
      title={`${pending.length} new from SMS`}
      footer={
        allConfident ? (
          <Button
            label={`Add all ${pending.length}`}
            variant="money"
            onPress={() => pending.forEach(add)}
          />
        ) : undefined
      }
    >
      {mismatch ? (
        <Card className="gap-2 border border-coral">
          <Text>
            App says {formatAmount(mismatch.appMinor)}, SMS says {formatAmount(mismatch.smsMinor)} —
            fix it?
          </Text>
          <View className="flex-row gap-2">
            <Button
              label="Leave it"
              size="sm"
              variant="secondary"
              onPress={() => setMismatch(null)}
              className="flex-1"
            />
            <Button
              label="Fix it"
              size="sm"
              onPress={() => {
                actions.fixBalance(mismatch);
                setMismatch(null);
              }}
              className="flex-1"
            />
          </View>
        </Card>
      ) : null}
      {pending.length === 0 ? (
        <EmptyState
          message="No SMS waiting. Everything's logged."
          actionLabel="SMS sources"
          onAction={() => router.replace("/settings/sms")}
          mood="relaxed"
        />
      ) : null}
      {pending.map((card) => (
        <CardView
          key={card.fingerprint}
          card={card}
          accountName={
            card.kind === "transfer" && card.toAccountId
              ? `${accountName(card.accountId)} → ${accountName(card.toAccountId)}`
              : accountName(card.accountId)
          }
          categories={categories}
          onAdd={() => add(card)}
          onIgnore={() => actions.ignore(card)}
          onEdit={() => {
            const kind = card.kind === "transfer" ? "expense" : card.kind;
            router.push(
              `/add?kind=${kind}&smsFingerprint=${encodeURIComponent(card.fingerprint)}&text=${encodeURIComponent(`${card.note} ${card.parsed.amountMinor / 100}`)}`,
            );
          }}
        />
      ))}
      {ignored.length > 0 ? (
        <>
          <Button
            label={`${showIgnored ? "Hide" : "Show"} ignored (${ignored.length})`}
            variant="ghost"
            size="sm"
            onPress={() => setShowIgnored(!showIgnored)}
          />
          {showIgnored
            ? ignored.map((card) => (
                <Card key={card.fingerprint} className="flex-row items-center gap-3 py-2">
                  <Text className="flex-1" numberOfLines={1}>
                    {card.sender} · {formatAmount(card.parsed.amountMinor)} · {card.note}
                  </Text>
                  <Button
                    label="Restore"
                    size="sm"
                    variant="secondary"
                    onPress={() => actions.restore(card)}
                  />
                </Card>
              ))
            : null}
        </>
      ) : null}
    </Sheet>
  );
}

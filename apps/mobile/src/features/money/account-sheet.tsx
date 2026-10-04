import { newId } from "@tick-taka/shared/ids";
import { formatAmount, parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useAccounts, useSettings } from "@/lib/queries";

type AccountType = "cash" | "bank" | "mobile_wallet" | "card" | "savings";
const TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "💵 Cash" },
  { value: "bank", label: "🏦 Bank" },
  { value: "mobile_wallet", label: "📱 Wallet" },
  { value: "card", label: "💳 Card" },
  { value: "savings", label: "🫙 Savings" },
];
const CURRENCIES = ["BDT", "USD", "EUR", "GBP"];

/** Create or edit an account; the balance check logs an adjustment for any gap. */
export function AccountSheet({ id }: { id: string | null }) {
  const { data: accounts } = useAccounts();
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id && !accounts?.some((a) => a.id === id))
    return (
      <Sheet title="Account">
        <SkeletonForm fields={4} />
      </Sheet>
    );
  return <AccountForm id={id} />;
}

function AccountForm({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const { data: accounts = [] } = useAccounts();
  const { data: settings } = useSettings();
  const account = id ? accounts.find((a) => a.id === id) : undefined;
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "cash");
  const [currency, setCurrency] = useState(account?.currency ?? "BDT");
  const [opening, setOpening] = useState(
    account ? String(toMajor(account.openingMinor, account.currency)) : "",
  );
  const [actual, setActual] = useState("");

  const save = () => {
    const openingMinor = parseAmountToMinor(opening || "0", currency) ?? 0;
    if (account)
      send({
        method: "PATCH",
        path: `/accounts/${account.id}`,
        body: { name: name.trim(), type, openingMinor, updatedAt: Date.now() },
        label: "Couldn't save",
      });
    else {
      const newAccountId = newId();
      send({
        method: "POST",
        path: "/accounts",
        body: { id: newAccountId, name: name.trim(), type, currency, openingMinor },
        label: "Couldn't add the account",
      });
      if (!settings?.defaultAccountId)
        send({
          method: "PATCH",
          path: "/settings",
          body: {
            defaultAccountId: newAccountId,
            ...(type === "cash" ? { cashAccountId: newAccountId } : {}),
          },
        });
    }
    router.back();
  };

  const balanceCheck = () => {
    if (!account) return;
    const actualMinor = parseAmountToMinor(actual, account.currency);
    if (actualMinor === null) return;
    const gap = actualMinor - account.balanceMinor;
    send({
      method: "POST",
      path: `/accounts/${account.id}/balance-check`,
      body: { actualMinor, id: newId() },
      label: "Couldn't log the adjustment",
    });
    notify(
      gap === 0
        ? "Already matches. Honest numbers!"
        : `Logged an adjustment of ${formatAmount(gap, { currency: account.currency, signed: true })}`,
    );
    setActual("");
  };

  return (
    <Sheet
      title={account ? account.name : "New account"}
      footer={
        <View className="flex-row gap-2">
          {account ? (
            <Button
              label="Archive"
              variant="secondary"
              onPress={() => {
                send({
                  method: "PATCH",
                  path: `/accounts/${account.id}`,
                  body: { archived: true },
                });
                notify(`Archived ${account.name}`, {
                  label: "Undo",
                  onPress: () =>
                    send({
                      method: "PATCH",
                      path: `/accounts/${account.id}`,
                      body: { archived: false },
                    }),
                });
                router.back();
              }}
            />
          ) : null}
          <Button label="Save" onPress={save} disabled={!name.trim()} className="flex-1" />
        </View>
      }
    >
      {account ? (
        <Card className="gap-2">
          <Text variant="strong">Balance check</Text>
          <Text tone="muted">
            App says {formatAmount(account.balanceMinor, { currency: account.currency })}. What does
            the real balance say?
          </Text>
          <View className="flex-row gap-2">
            <TextField
              value={actual}
              onChangeText={setActual}
              keyboardType="decimal-pad"
              placeholder="Real balance"
              className="flex-1"
            />
            <Button label="Fix it" disabled={!actual} onPress={balanceCheck} />
          </View>
        </Card>
      ) : null}
      <TextField label="Name" value={name} onChangeText={setName} placeholder="bKash" />
      <View className="flex-row flex-wrap gap-2">
        {TYPES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            tone="mint"
            selected={type === t.value}
            onPress={() => setType(t.value)}
          />
        ))}
      </View>
      {!account ? (
        <View className="flex-row flex-wrap gap-2">
          {CURRENCIES.map((c) => (
            <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
          ))}
        </View>
      ) : null}
      <TextField
        label="Opening balance"
        value={opening}
        onChangeText={setOpening}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      {account ? (
        <Button
          label="See transactions"
          variant="secondary"
          icon="swap-vertical"
          onPress={() => router.replace(`/money/transactions?accountId=${account.id}`)}
        />
      ) : null}
    </Sheet>
  );
}

import { parseLocalDate, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { formatAmount, parseAmountToMinor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Switch, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useAccounts } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { useColors } from "@/theme/colors";
import { useDebts } from "./queries";

type Direction = "owed_to_me" | "i_owe";

export function DebtSheet({ id }: { id: string | null }) {
  const { data: debts } = useDebts();
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id && !debts?.some((d) => d.id === id))
    return (
      <Sheet title="Loan">
        <SkeletonForm fields={4} />
      </Sheet>
    );
  return <DebtForm id={id} />;
}

/**
 * A new personal loan, optionally logging the money leaving or arriving now. An
 * existing loan edits only who, the note, the reminder and whether it's settled:
 * the direction, amount and opening account are fixed once created.
 */
function DebtForm({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const colors = useColors();
  const { data: debts } = useDebts();
  const { data: accounts = [] } = useAccounts();
  const debt = id ? debts?.find((d) => d.id === id) : undefined;
  const [direction, setDirection] = useState<Direction>(debt?.direction ?? "owed_to_me");
  const [person, setPerson] = useState(debt?.person ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState(debt?.note ?? "");
  const [accountId, setAccountId] = useState<string | null>(null);
  const reminder = debt?.remindAt ?? debt?.dueAt ?? null;
  const [remind, setRemind] = useState<string | null>(
    reminder === null ? null : toLocalDate(reminder),
  );
  const [closed, setClosed] = useState(Boolean(debt?.closedAt));
  const save = () => {
    if (!person.trim()) return;
    const remindAt = remind ? zonedTimeToUtc({ ...parseLocalDate(remind), hour: 10 }) : null;
    if (debt) {
      send({
        method: "PATCH",
        path: `/debts/${debt.id}`,
        body: {
          person: person.trim(),
          note: note || null,
          remindAt,
          dueAt: remindAt,
          // Re-sending "closed" would restamp when it was settled.
          ...(closed === Boolean(debt.closedAt) ? {} : { closed }),
          updatedAt: editTime(),
        },
        label: "Couldn't save",
      });
      router.back();
      return;
    }
    const principalMinor = parseAmountToMinor(amount);
    if (!principalMinor) return;
    send({
      method: "POST",
      path: "/debts",
      body: {
        id: newId(),
        person: person.trim(),
        direction,
        principalMinor,
        note: note || null,
        accountId,
        remindAt,
        dueAt: remindAt,
      },
      label: "Couldn't save",
    });
    router.back();
  };
  return (
    <Sheet
      title={debt ? debt.person : "New loan"}
      footer={
        <View className="flex-row gap-2">
          {debt ? (
            <DeleteButton
              onPress={() => {
                remove(`/debts/${debt.id}`, `“${debt.person}”`);
                router.back();
              }}
            />
          ) : null}
          <Button
            label="Save"
            onPress={save}
            disabled={!person.trim() || (!debt && !amount)}
            className="flex-1"
          />
        </View>
      }
    >
      {debt ? (
        <Text variant="caption" tone="muted">
          {debt.direction === "owed_to_me" ? "Lent" : "Borrowed"}{" "}
          {formatAmount(debt.principalMinor, { currency: debt.currency })}
        </Text>
      ) : (
        <Segmented<Direction>
          value={direction}
          onChange={setDirection}
          options={[
            { value: "owed_to_me", label: "I lent" },
            { value: "i_owe", label: "I borrowed" },
          ]}
        />
      )}
      <TextField label="Person" value={person} onChangeText={setPerson} placeholder="Name" />
      {debt ? null : (
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
        />
      )}
      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="For the bike repair"
      />
      {debt ? null : (
        <>
          <Text variant="label" tone="muted">
            {direction === "owed_to_me" ? "Paid from (optional)" : "Received into (optional)"}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label="Don't log money"
              selected={!accountId}
              onPress={() => setAccountId(null)}
            />
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                tone="mint"
                selected={accountId === a.id}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </View>
        </>
      )}
      <View className="flex-row gap-2">
        <Chip
          label={remind ? `Remind ${formatLocalDate(remind)}` : "Add a reminder"}
          tone="grape"
          selected={Boolean(remind)}
          onPress={async () => {
            const picked = await pickDate();
            if (picked) setRemind(picked);
          }}
        />
        {remind ? <Chip label="No reminder" onPress={() => setRemind(null)} /> : null}
      </View>
      {debt ? (
        <View className="flex-row items-center justify-between">
          <Text className="flex-1">Settled</Text>
          <Switch
            value={closed}
            onValueChange={setClosed}
            accessibilityLabel="Settled"
            trackColor={{ true: colors.mint, false: colors.lineStrong }}
          />
        </View>
      ) : null}
    </Sheet>
  );
}

import { parseLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useAccounts } from "@/lib/queries";

type Direction = "owed_to_me" | "i_owe";

/** A new personal loan, optionally logging the money leaving or arriving now. */
export function DebtSheet() {
  const router = useRouter();
  const send = useOutbox();
  const { data: accounts = [] } = useAccounts();
  const [direction, setDirection] = useState<Direction>("owed_to_me");
  const [person, setPerson] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [remind, setRemind] = useState<string | null>(null);
  const save = () => {
    const principalMinor = parseAmountToMinor(amount);
    if (!principalMinor || !person.trim()) return;
    const remindAt = remind ? zonedTimeToUtc({ ...parseLocalDate(remind), hour: 10 }) : null;
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
      title="New loan"
      footer={<Button label="Save" onPress={save} disabled={!person.trim() || !amount} />}
    >
      <Segmented<Direction>
        value={direction}
        onChange={setDirection}
        options={[
          { value: "owed_to_me", label: "I lent" },
          { value: "i_owe", label: "I borrowed" },
        ]}
      />
      <TextField label="Person" value={person} onChangeText={setPerson} placeholder="Name" />
      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <TextField
        label="Note"
        value={note}
        onChangeText={setNote}
        placeholder="For the bike repair"
      />
      <Text variant="label" tone="muted">
        {direction === "owed_to_me" ? "Paid from (optional)" : "Received into (optional)"}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Don't log money" selected={!accountId} onPress={() => setAccountId(null)} />
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
      <Chip
        label={remind ? `Remind ${formatLocalDate(remind)}` : "Add a reminder"}
        tone="grape"
        selected={Boolean(remind)}
        onPress={async () => {
          const picked = await pickDate();
          if (picked) setRemind(picked);
        }}
      />
    </Sheet>
  );
}

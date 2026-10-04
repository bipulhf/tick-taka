import {
  parseLocalDate,
  startOfLocalDay,
  toLocalDate,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { formatAmount, parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { describeRRule, parseRecurrence } from "@tick-taka/shared/recurrence";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useRecurring } from "@/features/plan/queries";
import { formatLocalDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";

type Kind = "bill" | "income";

/** Create or edit a bill or expected income; "Paid"/"Received" logs it and moves the date. */
export function RecurringSheet({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const { data: list } = useRecurring();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const item = id ? list?.find((r) => r.id === id) : undefined;
  const [kind, setKind] = useState<Kind>(item?.kind ?? "bill");
  const [name, setName] = useState(item?.name ?? "");
  const [amount, setAmount] = useState(
    item ? String(toMajor(item.amountMinor, item.currency)) : "",
  );
  const [currency, setCurrency] = useState(item?.currency ?? "BDT");
  const [accountId, setAccountId] = useState<string | null>(
    item?.accountId ?? settings?.defaultAccountId ?? null,
  );
  const [categoryId, setCategoryId] = useState<string | null>(item?.categoryId ?? null);
  const [repeat, setRepeat] = useState("");
  const [dueDate, setDueDate] = useState(item?.dueDate ?? toLocalDate(Date.now(), timeZone));
  const [remindDays, setRemindDays] = useState(item?.remindDays ?? 2);
  const [rate, setRate] = useState("");
  const parsed = useMemo(() => (repeat.trim() ? parseRecurrence(`x ${repeat}`) : null), [repeat]);
  const rrule = parsed?.rrule ?? item?.rrule ?? "FREQ=MONTHLY";
  const account = accounts.find((a) => a.id === accountId);
  const foreign = account && account.currency !== currency;

  if (id && !item)
    return (
      <Sheet title="Bill">
        <Text tone="muted">Loading…</Text>
      </Sheet>
    );

  const save = () => {
    const amountMinor = parseAmountToMinor(amount, currency);
    if (!amountMinor || !name.trim()) return;
    const nextDueAt = zonedTimeToUtc({ ...parseLocalDate(dueDate), hour: 9 }, timeZone);
    const body = {
      kind,
      name: name.trim(),
      amountMinor,
      currency,
      accountId,
      categoryId,
      rrule,
      nextDueAt,
      remindDays,
    };
    if (item)
      send({
        method: "PATCH",
        path: `/recurring/${item.id}`,
        body: { ...body, updatedAt: Date.now() },
        label: "Couldn't save",
      });
    else
      send({
        method: "POST",
        path: "/recurring",
        body: { id: newId(), ...body },
        label: "Couldn't save",
      });
    router.back();
  };

  const pay = (skip = false) => {
    if (!item) return;
    const body: Record<string, unknown> = {
      transactionId: newId(),
      skip,
      ...(accountId ? { accountId } : {}),
    };
    if (foreign && !skip) {
      const value = Number(rate);
      if (!(value > 0)) return notify(`Enter the ${currency} → ${account?.currency} rate`);
      body.rate = value;
    }
    send({
      method: "POST",
      path: `/recurring/${item.id}/pay`,
      body,
      label: `Couldn't log ${item.name}`,
    });
    notify(skip ? "Skipped this one" : `${item.name} logged`);
    router.back();
  };

  return (
    <Sheet
      title={item ? item.name : "New bill or income"}
      footer={
        <View className="gap-2">
          {item ? (
            <View className="flex-row gap-2">
              <Button
                label="Skip"
                variant="secondary"
                onPress={() => pay(true)}
                className="flex-1"
              />
              <Button
                label={item.kind === "bill" ? "Paid" : "Received"}
                variant="money"
                onPress={() => pay()}
                className="flex-1"
              />
            </View>
          ) : null}
          <Button
            label="Save"
            variant={item ? "secondary" : "primary"}
            onPress={save}
            disabled={!name.trim() || !amount}
          />
        </View>
      }
    >
      {item ? (
        <Card>
          <Text>
            Next due {formatLocalDate(item.dueDate, "long")} ·{" "}
            {formatAmount(item.amountMinor, { currency: item.currency })}
          </Text>
          {foreign ? (
            <TextField
              label={`Rate: ${account?.currency} per 1 ${currency}`}
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              placeholder="121.50"
            />
          ) : null}
        </Card>
      ) : null}
      <Segmented<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: "bill", label: "Bill" },
          { value: "income", label: "Income" },
        ]}
      />
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder={kind === "bill" ? "Internet" : "Job 1 salary"}
      />
      <View className="flex-row gap-2">
        <TextField
          label="Amount"
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          className="flex-1"
        />
        <View className="justify-end gap-1">
          <View className="flex-row gap-1">
            {["BDT", "USD", "EUR"].map((c) => (
              <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
            ))}
          </View>
        </View>
      </View>
      <TextField
        label="Repeats"
        value={repeat}
        onChangeText={setRepeat}
        placeholder={describeRRule(rrule)}
        error={repeat && !parsed ? "Try “every month on the 5th”" : undefined}
      />
      {parsed ? (
        <Text variant="caption" tone="sky">
          ↻ {describeRRule(parsed.rrule)}
        </Text>
      ) : null}
      <Chip
        label={`Next due ${formatLocalDate(dueDate)}`}
        tone="sky"
        selected
        onPress={async () => {
          const picked = await pickDate(startOfLocalDay(dueDate, timeZone), timeZone);
          if (picked) setDueDate(picked);
        }}
      />
      <Text variant="label" tone="muted">
        Remind me
      </Text>
      <View className="flex-row gap-2">
        {[0, 1, 2, 3, 7].map((d) => (
          <Chip
            key={d}
            label={d === 0 ? "On the day" : `${d}d before`}
            selected={remindDays === d}
            onPress={() => setRemindDays(d)}
          />
        ))}
      </View>
      <Text variant="label" tone="muted">
        Account
      </Text>
      <View className="flex-row flex-wrap gap-2">
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
      <Text variant="label" tone="muted">
        Category
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {categories
          .filter((c) => c.kind === (kind === "bill" ? "expense" : "income"))
          .map((c) => (
            <Chip
              key={c.id}
              label={`${c.emoji} ${c.name}`}
              tone="coral"
              selected={categoryId === c.id}
              onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
            />
          ))}
      </View>
      {item ? (
        <Button
          label="Delete"
          variant="ghost"
          onPress={() => {
            send({ method: "DELETE", path: `/recurring/${item.id}` });
            notify(`Deleted ${item.name}`, {
              label: "Undo",
              onPress: () => send({ method: "POST", path: `/recurring/${item.id}/restore` }),
            });
            router.back();
          }}
        />
      ) : null}
    </Sheet>
  );
}

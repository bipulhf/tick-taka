import {
  parseLocalDate,
  startOfLocalDay,
  toLocalDate,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { toAsciiDigits } from "@tick-taka/shared/digits";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { describeRRule, parseRecurrence } from "@tick-taka/shared/recurrence";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DateField } from "@/components/ui/date-field";
import { DeleteButton } from "@/components/ui/delete-button";
import { PickerField } from "@/components/ui/picker-field";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { payRecurring } from "@/features/money/recurring-pay";
import { useRecurring } from "@/features/plan/queries";
import { formatAmount, formatLocalDate, plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { pickDate } from "@/lib/pick-date";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { userTime } from "@/lib/user-time";

type Kind = "bill" | "income";

const CURRENCIES = ["BDT", "USD", "EUR"];
const REMIND_DAYS = [0, 1, 2, 3, 7];
const remindLabel = (days: number) => (days === 0 ? "On the day" : `${plural(days, "day")} before`);

/** Create or edit a bill or expected income; "Paid"/"Received" logs it and moves the date. */
export function RecurringSheet({ id }: { id: string | null }) {
  const { data: list } = useRecurring();
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id && !list?.some((r) => r.id === id))
    return (
      <Sheet title="Bill">
        <SkeletonForm fields={6} />
      </Sheet>
    );
  return <RecurringForm id={id} />;
}

function RecurringForm({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const { data: list } = useRecurring();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const timeZone = userTime(settings).timeZone;
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
        body: { ...body, updatedAt: editTime() },
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
      // The due date this pay is for: a replay or double tap then changes nothing.
      dueAt: item.nextDueAt,
      skip,
      ...(accountId ? { accountId } : {}),
    };
    if (foreign && !skip) {
      const value = Number(toAsciiDigits(rate.trim()));
      if (!(value > 0)) return notify(`Enter the ${currency} → ${account?.currency} rate`);
      body.rate = value;
    }
    const undo = payRecurring(send, item, body);
    notify(skip ? "Skipped this one" : `${item.name} logged`, {
      label: "Undo",
      onPress: () => {
        undo();
        notify(`Took back ${item.name}`);
      },
    });
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
          <View className="flex-row gap-2">
            {item ? (
              <DeleteButton
                onPress={() => {
                  remove(`/recurring/${item.id}`, `“${item.name}”`);
                  router.back();
                }}
              />
            ) : null}
            <Button
              label="Save"
              variant={item ? "secondary" : "primary"}
              onPress={save}
              disabled={!name.trim() || !amount}
              className="flex-1"
            />
          </View>
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
        label="Kind"
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
      <TextField
        label="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />
      <PickerField
        label="Currency"
        value={currency}
        options={CURRENCIES.map((c) => ({ id: c, label: c }))}
        onChange={(c) => setCurrency(c ?? currency)}
      />
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
      <View className="flex-row gap-3">
        <DateField
          label="Next due"
          span="half"
          value={formatLocalDate(dueDate)}
          onPress={async () => {
            const picked = await pickDate(startOfLocalDay(dueDate, timeZone), timeZone);
            if (picked) setDueDate(picked);
          }}
        />
        <PickerField
          label="Remind me"
          span="half"
          value={String(remindDays)}
          options={REMIND_DAYS.map((d) => ({ id: String(d), label: remindLabel(d) }))}
          describe={(d) => remindLabel(Number(d))}
          onChange={(d) => setRemindDays(d === null ? remindDays : Number(d))}
        />
      </View>
      <View className="flex-row gap-3">
        <PickerField
          label="Account"
          span="half"
          value={accountId}
          options={accounts.map((a) => ({ id: a.id, label: a.name }))}
          onChange={(id) => id && setAccountId(id)}
        />
        <PickerField
          label="Category"
          span="half"
          value={categoryId}
          noneLabel="No category"
          options={categories
            .filter((c) => c.kind === (kind === "bill" ? "expense" : "income"))
            .map((c) => ({ id: c.id, label: c.name, emoji: c.emoji }))}
          onChange={setCategoryId}
        />
      </View>
    </Sheet>
  );
}

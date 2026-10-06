import { zodResolver } from "@hookform/resolvers/zod";
import { toLocalDate } from "@tick-taka/shared/dates";
import { costInHours } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { AmountKeypad } from "@/components/ui/amount-keypad";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { PickerField } from "@/components/ui/picker-field";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatWhen, plural } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { pickDate, pickTime } from "@/lib/pick-date";
import { useAccounts, useAreas, useCategories, useHourlyRate, useSettings } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { playSound } from "@/lib/sounds";
import { useRemove } from "@/lib/use-remove";
import { userTime } from "@/lib/user-time";
import { useEvents, useTransaction } from "./queries";
import { type Form, formSchema, type TxType } from "./transaction-form";
import { TransactionReceipt } from "./transaction-receipt";

/** Create or edit a transaction in a bottom sheet. */
export function TransactionSheet({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const removeRecord = useRemove();
  const existing = useTransaction(id);
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const { data: events = [] } = useEvents();
  const hourly = useHourlyRate();
  const timeZone = userTime(settings).timeZone;
  const [keypadKey, setKeypadKey] = useState(0);

  const form = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      type: "expense",
      amountMinor: 0,
      toAmountMinor: null,
      feeMinor: 0,
      accountId: settings?.defaultAccountId ?? accounts[0]?.id ?? "",
      toAccountId: null,
      categoryId: null,
      areaId: null,
      eventId: null,
      note: "",
      occurredAt: Date.now(),
      receiptPath: null,
    },
  });
  const values = form.watch();

  useEffect(() => {
    const tx = existing.data;
    if (!tx) return;
    form.reset({
      type: tx.type,
      amountMinor: Math.abs(tx.amountMinor),
      toAmountMinor: tx.toAmountMinor,
      feeMinor: tx.feeMinor,
      accountId: tx.accountId,
      toAccountId: tx.toAccountId,
      categoryId: tx.categoryId,
      areaId: tx.areaId,
      eventId: tx.eventId,
      note: tx.note ?? "",
      occurredAt: tx.occurredAt,
      receiptPath: tx.receiptPath,
    });
    setKeypadKey((k) => k + 1);
  }, [existing.data, form]);

  useEffect(() => {
    if (!values.accountId && accounts[0])
      form.setValue("accountId", settings?.defaultAccountId ?? accounts[0].id);
  }, [accounts, settings, values.accountId, form]);

  const account = accounts.find((a) => a.id === values.accountId);
  const toAccount = accounts.find((a) => a.id === values.toAccountId);
  const crossCurrency =
    values.type === "transfer" && account && toAccount && account.currency !== toAccount.currency;
  const hours =
    values.type === "expense" &&
    settings?.costInHours &&
    values.amountMinor >= settings.costInHoursThresholdMinor
      ? costInHours(values.amountMinor, hourly.data?.rateMinor ?? null)
      : null;

  const submit = form.handleSubmit((data) => {
    const body = {
      ...data,
      amountMinor:
        data.type === "adjustment"
          ? (existing.data?.amountMinor ?? data.amountMinor)
          : data.amountMinor,
      toAccountId: data.type === "transfer" ? data.toAccountId : null,
      toAmountMinor: crossCurrency ? data.toAmountMinor : null,
      categoryId: data.type === "transfer" ? null : data.categoryId,
      note: data.note.trim() || null,
    };
    if (id) {
      send({
        method: "PATCH",
        path: `/transactions/${id}`,
        body: { ...body, updatedAt: editTime() },
        label: "Couldn't save",
      });
      if (existing.data && body.categoryId !== existing.data.categoryId && body.note)
        notify("Got it. Next time this goes to the same category.");
    } else {
      send({
        method: "POST",
        path: "/transactions",
        body: { id: newId(), ...body },
        label: "Couldn't save",
      });
      haptic.success();
      playSound("pop");
    }
    router.back();
  });

  const remove = () => {
    if (!id) return;
    removeRecord(`/transactions/${id}`, "the transaction");
    router.back();
  };

  const accountOptions = accounts.map((a) => ({ id: a.id, label: a.name }));
  const kindCategories = categories.filter(
    (c) => c.kind === (values.type === "income" ? "income" : "expense"),
  );
  const tone = values.type === "income" ? "mint" : values.type === "expense" ? "coral" : "ink";
  const errors = form.formState.errors;

  if (id && !existing.data)
    return (
      <Sheet title="Transaction">
        <SkeletonForm fields={5} />
      </Sheet>
    );

  return (
    <Sheet
      title={id ? "Transaction" : "New transaction"}
      footer={
        <View className="flex-row gap-2">
          {id ? <DeleteButton onPress={remove} /> : null}
          <Button label="Save" onPress={submit} className="flex-1" />
        </View>
      }
    >
      {values.type !== "adjustment" ? (
        <Segmented<TxType>
          label="Type"
          value={values.type as TxType}
          onChange={(type) => form.setValue("type", type)}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
            { value: "transfer", label: "Transfer" },
          ]}
        />
      ) : (
        <Text tone="muted">Balance check adjustment</Text>
      )}
      <AmountKeypad
        key={keypadKey}
        initial={values.amountMinor ? String(toMajor(values.amountMinor, account?.currency)) : ""}
        currency={account?.currency}
        tone={tone}
        onChange={(minor) =>
          form.setValue("amountMinor", minor ?? 0, { shouldValidate: form.formState.isSubmitted })
        }
      />
      {errors.amountMinor ? (
        <Text tone="coral" variant="caption">
          {errors.amountMinor.message}
        </Text>
      ) : null}
      {hours ? (
        <Text variant="caption" tone="muted">
          ≈ {plural(hours, "hour")} of work
        </Text>
      ) : null}

      <View className="flex-row gap-3">
        <PickerField
          label={values.type === "transfer" ? "From" : "Account"}
          span="half"
          value={values.accountId || null}
          options={accountOptions}
          onChange={(accountId) => accountId && form.setValue("accountId", accountId)}
        />
        {values.type === "transfer" ? (
          <PickerField
            label="To"
            span="half"
            value={values.toAccountId}
            options={accountOptions.filter((a) => a.id !== values.accountId)}
            onChange={(toAccountId) => form.setValue("toAccountId", toAccountId)}
          />
        ) : (
          <PickerField
            label="Category"
            span="half"
            value={values.categoryId}
            noneLabel="No category"
            options={kindCategories.map((c) => ({ id: c.id, label: c.name, emoji: c.emoji }))}
            onChange={(categoryId) => form.setValue("categoryId", categoryId)}
          />
        )}
      </View>
      {values.type === "transfer" ? (
        <>
          {errors.toAccountId ? (
            <Text tone="coral" variant="caption">
              {errors.toAccountId.message}
            </Text>
          ) : null}
          {crossCurrency ? (
            <TextField
              label={`Arrived in ${toAccount?.currency}`}
              keyboardType="decimal-pad"
              defaultValue={
                values.toAmountMinor
                  ? String(toMajor(values.toAmountMinor, toAccount?.currency))
                  : ""
              }
              onChangeText={(v) => {
                const minor = parseAmountToMinor(v, toAccount?.currency);
                form.setValue("toAmountMinor", minor !== null && minor > 0 ? minor : null);
              }}
            />
          ) : null}
          <TextField
            label="Fee (e.g. cash-out charge)"
            keyboardType="decimal-pad"
            defaultValue={values.feeMinor ? String(toMajor(values.feeMinor)) : ""}
            onChangeText={(v) =>
              form.setValue("feeMinor", Math.max(0, parseAmountToMinor(v, account?.currency) ?? 0))
            }
          />
        </>
      ) : null}
      <Controller
        control={form.control}
        name="note"
        render={({ field }) => (
          <TextField
            label="Note"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="Merchant or person"
          />
        )}
      />
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={formatWhen(values.occurredAt, true, Date.now(), timeZone)}
          tone="sky"
          selected
          onPress={async () => {
            const date = await pickDate(values.occurredAt, timeZone);
            if (!date) return;
            const at = await pickTime(date, values.occurredAt, timeZone);
            form.setValue("occurredAt", at ?? values.occurredAt);
          }}
        />
        <Chip
          label="Now"
          onPress={() => form.setValue("occurredAt", Date.now())}
          selected={toLocalDate(values.occurredAt, timeZone) === toLocalDate(Date.now(), timeZone)}
        />
      </View>
      <View className="flex-row gap-3">
        <PickerField
          label="Area"
          span="half"
          value={values.areaId}
          noneLabel="No area"
          options={areas.map((a) => ({ id: a.id, label: a.name, emoji: a.emoji }))}
          onChange={(areaId) => form.setValue("areaId", areaId)}
        />
        {events.length > 0 ? (
          <PickerField
            label="Event"
            span="half"
            value={values.eventId}
            noneLabel="No event"
            options={events.map((e) => ({ id: e.id, label: e.name, emoji: e.emoji }))}
            onChange={(eventId) => form.setValue("eventId", eventId)}
          />
        ) : null}
      </View>
      <TransactionReceipt
        id={id}
        form={form}
        values={values}
        onRead={() => setKeypadKey((k) => k + 1)}
      />
    </Sheet>
  );
}

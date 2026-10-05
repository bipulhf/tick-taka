import { zodResolver } from "@hookform/resolvers/zod";
import { toLocalDate } from "@tick-taka/shared/dates";
import { costInHours } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import { toMajor, toMinor } from "@tick-taka/shared/money";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { View } from "react-native";
import { z } from "zod";
import { AmountKeypad } from "@/components/ui/amount-keypad";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { pickDate, pickTime } from "@/lib/pick-date";
import {
  useAccounts,
  useAiStatus,
  useAreas,
  useCategories,
  useHourlyRate,
  useSettings,
} from "@/lib/queries";
import { pickReceipt, receiptUrl, uploadReceipt } from "@/lib/receipts";
import { editTime } from "@/lib/server-clock";
import { playSound } from "@/lib/sounds";
import { useEvents, useTransaction } from "./queries";

type TxType = "expense" | "income" | "transfer";

const formSchema = z
  .object({
    type: z.enum(["expense", "income", "transfer", "adjustment"]),
    amountMinor: z.number().int().positive("Enter an amount"),
    toAmountMinor: z.number().int().positive().nullable(),
    feeMinor: z.number().int().nonnegative(),
    accountId: z.string().min(1, "Pick an account"),
    toAccountId: z.string().nullable(),
    categoryId: z.string().nullable(),
    areaId: z.string().nullable(),
    eventId: z.string().nullable(),
    note: z.string().max(2000),
    occurredAt: z.number().int(),
    receiptPath: z.string().nullable(),
  })
  .refine((v) => v.type !== "transfer" || (v.toAccountId && v.toAccountId !== v.accountId), {
    message: "Pick a different account to move money to",
    path: ["toAccountId"],
  });
type Form = z.infer<typeof formSchema>;

/** Create or edit a transaction in a bottom sheet. */
export function TransactionSheet({ id }: { id: string | null }) {
  const router = useRouter();
  const send = useOutbox();
  const existing = useTransaction(id);
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const { data: events = [] } = useEvents();
  const ai = useAiStatus();
  const hourly = useHourlyRate();
  const timeZone = settings?.timeZone ?? "Asia/Dhaka";
  const [keypadKey, setKeypadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);

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

  const attachReceipt = async (source: "camera" | "library") => {
    const image = await pickReceipt(source);
    if (!image) return;
    setBusy("receipt");
    try {
      const path = await uploadReceipt(image);
      form.setValue("receiptPath", path);
      if (ai.data?.configured && ai.data.features.receipt && !id) {
        const result = await unwrap(
          api.ai.receipt.$post({ json: { imageBase64: image.base64, mimeType: image.mimeType } }),
        );
        const draft = result.draft;
        if (draft.kind === "expense") {
          if (draft.amountMinor) form.setValue("amountMinor", draft.amountMinor);
          if (draft.categoryId) form.setValue("categoryId", draft.categoryId);
          if (draft.note) form.setValue("note", draft.note);
          form.setValue("occurredAt", draft.occurredAt);
          setKeypadKey((k) => k + 1);
          notify("✨ Read the receipt. Check it before saving.");
        }
      }
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    if (!id) return;
    send({ method: "DELETE", path: `/transactions/${id}`, label: "Couldn't delete" });
    notify("Transaction deleted", {
      label: "Undo",
      onPress: () => send({ method: "POST", path: `/transactions/${id}/restore` }),
    });
    router.back();
  };

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
          {id ? (
            <Button label="Delete" variant="secondary" icon="trash-can-outline" onPress={remove} />
          ) : null}
          <Button label="Save" onPress={submit} className="flex-1" />
        </View>
      }
    >
      {values.type !== "adjustment" ? (
        <Segmented<TxType>
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
          ≈ {hours} {hours === 1 ? "hour" : "hours"} of work
        </Text>
      ) : null}

      <Text variant="label" tone="muted">
        {values.type === "transfer" ? "From" : "Account"}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {accounts.map((a) => (
          <Chip
            key={a.id}
            label={a.name}
            tone="mint"
            selected={values.accountId === a.id}
            onPress={() => form.setValue("accountId", a.id)}
          />
        ))}
      </View>
      {values.type === "transfer" ? (
        <>
          <Text variant="label" tone="muted">
            To
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {accounts
              .filter((a) => a.id !== values.accountId)
              .map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  tone="mint"
                  selected={values.toAccountId === a.id}
                  onPress={() => form.setValue("toAccountId", a.id)}
                />
              ))}
          </View>
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
              onChangeText={(v) =>
                form.setValue(
                  "toAmountMinor",
                  Number(v) > 0 ? toMinor(Number(v), toAccount?.currency) : null,
                )
              }
            />
          ) : null}
          <TextField
            label="Fee (e.g. cash-out charge)"
            keyboardType="decimal-pad"
            defaultValue={values.feeMinor ? String(toMajor(values.feeMinor)) : ""}
            onChangeText={(v) =>
              form.setValue("feeMinor", Math.max(0, toMinor(Number(v) || 0, account?.currency)))
            }
          />
        </>
      ) : (
        <>
          <Text variant="label" tone="muted">
            Category
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {kindCategories.map((c) => (
              <Chip
                key={c.id}
                label={`${c.emoji} ${c.name}`}
                tone={values.type === "income" ? "mint" : "coral"}
                selected={values.categoryId === c.id}
                onPress={() =>
                  form.setValue("categoryId", values.categoryId === c.id ? null : c.id)
                }
              />
            ))}
          </View>
        </>
      )}
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
      <Text variant="label" tone="muted">
        Area
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {areas.map((a) => (
          <Chip
            key={a.id}
            label={`${a.emoji} ${a.name}`}
            tone="sky"
            selected={values.areaId === a.id}
            onPress={() => form.setValue("areaId", values.areaId === a.id ? null : a.id)}
          />
        ))}
      </View>
      {events.length > 0 ? (
        <>
          <Text variant="label" tone="muted">
            Event
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {events.map((e) => (
              <Chip
                key={e.id}
                label={`${e.emoji} ${e.name}`}
                tone="grape"
                selected={values.eventId === e.id}
                onPress={() => form.setValue("eventId", values.eventId === e.id ? null : e.id)}
              />
            ))}
          </View>
        </>
      ) : null}
      <Text variant="label" tone="muted">
        Receipt
      </Text>
      {values.receiptPath ? (
        <Image
          source={{ uri: receiptUrl(values.receiptPath) }}
          style={{ height: 180, borderRadius: 16 }}
          contentFit="cover"
          accessibilityLabel="Receipt photo"
        />
      ) : null}
      <View className="flex-row gap-2">
        <Button
          label="Camera"
          icon="camera-outline"
          variant="secondary"
          size="sm"
          loading={busy === "receipt"}
          onPress={() => attachReceipt("camera")}
          className="flex-1"
        />
        <Button
          label="Gallery"
          icon="image-outline"
          variant="secondary"
          size="sm"
          onPress={() => attachReceipt("library")}
          className="flex-1"
        />
      </View>
    </Sheet>
  );
}

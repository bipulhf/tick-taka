import { Image } from "expo-image";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { api, unwrap } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useAiStatus } from "@/lib/queries";
import { pickReceipt, receiptSource, uploadReceipt } from "@/lib/receipts";
import type { Form } from "./transaction-form";

/** Receipt photo for a transaction; on a new one, AI can read the amount and category from it. */
export function TransactionReceipt({
  id,
  form,
  values,
  onRead,
}: {
  id: string | null;
  form: UseFormReturn<Form>;
  values: Form;
  /** The receipt filled the amount in: redraw the keypad with it. */
  onRead: () => void;
}) {
  const ai = useAiStatus();
  const [busy, setBusy] = useState<string | null>(null);

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
          onRead();
          notify("✨ Read the receipt. Check it before saving.");
        }
      }
    } catch (error) {
      notify((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Text variant="label" tone="muted">
        Receipt
      </Text>
      {values.receiptPath ? (
        <Image
          source={receiptSource(values.receiptPath)}
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
    </>
  );
}

import { useState } from "react";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { useOpenPanel } from "@/lib/panel";
import { useAiStatus } from "@/lib/queries";
import { notify, notifyError } from "@/lib/toast";
import type { PresetValue } from "./quick-add-presets";
import { isReceiptType, prepareReceipt, toBase64, uploadReceipt } from "./receipt";

/**
 * A receipt image dropped, pasted or picked on the quick-add field: it is uploaded,
 * read by AI when that is on, and opens a new expense with what was read. Without
 * AI the expense opens with just the receipt attached.
 */
export function useReceiptScan() {
  const open = useOpenPanel();
  const ai = useAiStatus();
  const [scanning, setScanning] = useState(false);
  const canRead = Boolean(ai.data?.configured && ai.data.features.receipt && !ai.data.capReached);

  const scan = async (file: File) => {
    if (!isReceiptType(file.type)) {
      notifyError("Receipts must be JPEG, PNG or WebP");
      return;
    }
    setScanning(true);
    try {
      const image = await prepareReceipt(file);
      const receiptPath = await uploadReceipt(image);
      const preset: Record<string, PresetValue> = { type: "expense", receiptPath };
      if (canRead) {
        try {
          const result = await unwrap(
            api.ai.receipt.$post({
              json: { imageBase64: await toBase64(image.blob), mimeType: image.mimeType },
            }),
          );
          const draft = result.draft;
          if (draft.kind === "expense") {
            Object.assign(preset, {
              amountMinor: draft.amountMinor ?? undefined,
              categoryId: draft.categoryId,
              accountId: draft.accountId,
              note: draft.note || undefined,
              occurredAt: draft.occurredAt,
            });
            notify("✨ Read the receipt. Check it before saving.");
          }
        } catch (error) {
          // The receipt is still attached; the rest is typed by hand.
          notifyError(friendlyError(error));
        }
      }
      open("transaction:new", preset);
    } catch (error) {
      notifyError(friendlyError(error));
    } finally {
      setScanning(false);
    }
  };

  return { scan, scanning, canRead };
}

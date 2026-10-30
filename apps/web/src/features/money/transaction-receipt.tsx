import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { useAiStatus } from "@/lib/queries";
import { notify, notifyError } from "@/lib/toast";
import { fileToBase64, isReceiptFile, uploadReceipt, useReceiptUrl } from "./receipts";

export interface ReceiptRead {
  amountMinor?: number | null;
  categoryId?: string | null;
  note?: string | null;
  occurredAt: number;
}

/**
 * The receipt photo of a transaction: pick a file, drop one or paste a screenshot.
 * On a new transaction, AI (when set up) reads the amount and category from it.
 */
export function TransactionReceipt({
  isNew,
  path,
  onPath,
  onRead,
  dropTarget,
}: {
  isNew: boolean;
  path: string | null;
  onPath: (path: string | null) => void;
  onRead: (read: ReceiptRead) => void;
  /** Files dropped or pasted on the panel arrive here. */
  dropTarget: { current: ((file: File) => void) | null };
}) {
  const ai = useAiStatus();
  const url = useReceiptUrl(path);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const attach = async (file: File) => {
    if (!isReceiptFile(file)) {
      notify("Receipts must be a JPEG, PNG or WebP image.");
      return;
    }
    setBusy(true);
    try {
      onPath(await uploadReceipt(file));
      if (ai.data?.configured && ai.data.features.receipt && isNew) {
        const result = await unwrap(
          api.ai.receipt.$post({
            json: { imageBase64: await fileToBase64(file), mimeType: file.type },
          }),
        );
        const draft = result.draft;
        if (draft.kind === "expense") {
          onRead(draft);
          notify("✨ Read the receipt. Check it before saving.");
        }
      }
    } catch (error) {
      notifyError(friendlyError(error));
    } finally {
      setBusy(false);
    }
  };
  dropTarget.current = (file) => void attach(file);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-muted">Receipt</span>
      {path ? (
        <div className="relative">
          {url.data ? (
            <a href={url.data} target="_blank" rel="noreferrer" className="block rounded-2xl">
              <img
                src={url.data}
                alt="Receipt"
                className="h-44 w-full rounded-2xl border border-line object-cover"
              />
            </a>
          ) : (
            <div className="h-44 w-full animate-pulse rounded-2xl bg-line/70" />
          )}
          <button
            type="button"
            aria-label="Remove the receipt"
            onClick={() => onPath(null)}
            className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-ink/70 text-background hover:bg-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
      <div className="flex items-center gap-3">
        <Button size="sm" icon={ImagePlus} loading={busy} onClick={() => input.current?.click()}>
          {path ? "Replace photo" : "Attach a photo"}
        </Button>
        <span className="text-caption font-normal text-muted">or drop or paste one here</span>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void attach(file);
        }}
      />
    </div>
  );
}

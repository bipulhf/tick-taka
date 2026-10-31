import { useQueryClient } from "@tanstack/react-query";
import { Plus, ReceiptText } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/components/ui/cx";
import { IconButton } from "@/components/ui/icon-button";
import { Kbd } from "@/components/ui/kbd";
import { useOpenPanel } from "@/lib/panel";
import { playSound } from "@/lib/sounds";
import { useStore } from "@/lib/store";
import { notify } from "@/lib/toast";
import { quickAddFocusStore } from "@/lib/ui-state";
import { fire, write } from "@/lib/write";
import { applyOptimisticExpense } from "./optimistic-expense";
import { draftPanel } from "./quick-add-presets";
import { draftSummary, QuickAddPreview } from "./quick-add-preview";
import { undoRequest } from "./quick-add-requests";
import { firstImage } from "./receipt";
import { useQuickAdd } from "./use-quick-add";
import { useReceiptScan } from "./use-receipt-scan";

/** Radix pickers open in a portal; a click there still belongs to quick-add. */
const inPopper = (node: EventTarget | null) =>
  node instanceof Element && Boolean(node.closest("[data-radix-popper-content-wrapper]"));

/**
 * The top bar's capture field: type anything, see what it understood, Enter saves
 * (with Undo), Shift+Enter opens the full panel. Receipts can be dropped or pasted
 * on it. N or / anywhere, or the + on a phone, puts the cursor here.
 */
export function QuickAddBar() {
  const client = useQueryClient();
  const open = useOpenPanel();
  const qa = useQuickAdd();
  const receipt = useReceiptScan();
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const summaryId = useId();
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const focusRequest = useStore(quickAddFocusStore);

  useEffect(() => {
    if (focusRequest) input.current?.focus();
  }, [focusRequest]);

  // Clicking anywhere else closes the preview (the text stays for later).
  useEffect(() => {
    if (!active) return;
    const onDown = (event: PointerEvent) => {
      if (wrap.current?.contains(event.target as Node) || inPopper(event.target)) return;
      setActive(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [active]);

  const requests = qa.buildRequests();
  const showPreview = active && (qa.text.trim() !== "" || qa.aiBusy);

  const save = async () => {
    const all = qa.buildRequests();
    const [first, ...rest] = all ?? [];
    if (!all || !first || saving) return;
    const summary = draftSummary(qa);
    setSaving(true);
    try {
      applyOptimisticExpense(client, first);
      await write(first);
      for (const request of rest) fire(request);
      playSound("pop");
      // Say what was understood, so a misparse is noticed and undone in one click.
      const undo = undoRequest(all);
      notify(
        summary ? `Saved: ${summary}` : "Saved",
        undo ? { label: "Undo", onPress: () => fire(undo) } : undefined,
      );
      qa.reset();
    } catch {
      // The toast says why; the text stays to try again.
    } finally {
      setSaving(false);
    }
  };

  const openFull = () => {
    const target = draftPanel(qa.text.trim() ? qa.draft : null);
    open(target.panel, target.preset);
    qa.reset();
    setActive(false);
    input.current?.blur();
  };

  const takeFile = (files: FileList | null | undefined) => {
    const image = firstImage(files);
    if (!image) return false;
    setActive(false);
    void receipt.scan(image);
    return true;
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a drop target for receipts and a focus boundary; the input inside is the control
    <div
      ref={wrap}
      data-tour="quick-add"
      className="relative mx-auto w-full max-w-[640px]"
      onFocus={() => setActive(true)}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next && !wrap.current?.contains(next as Node) && !inPopper(next)) setActive(false);
      }}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        setDragging(false);
        if (takeFile(event.dataTransfer.files)) event.preventDefault();
      }}
    >
      <Plus
        aria-hidden
        className="pointer-events-none absolute top-5 left-3 size-5 -translate-y-1/2 text-muted"
      />
      <input
        ref={input}
        value={qa.text}
        onChange={(event) => qa.setText(event.target.value)}
        aria-label="Quick add"
        aria-describedby={showPreview ? summaryId : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={
          dragging
            ? "Drop the receipt to read it"
            : "Add anything: cha 20, 2h thesis, call bank tomorrow 5pm"
        }
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            if (event.shiftKey) openFull();
            else if (requests) void save();
            else if (qa.draft) openFull();
          } else if (event.key === "Escape") {
            event.preventDefault();
            if (qa.text) qa.reset();
            else event.currentTarget.blur();
          }
        }}
        onPaste={(event) => {
          if (takeFile(event.clipboardData.files)) event.preventDefault();
        }}
        className={cx(
          "h-10 w-full rounded-2xl border bg-card pr-12 pl-10 text-body outline-none transition-colors placeholder:text-muted focus:border-sky-text focus:ring-2 focus:ring-sky/25",
          dragging ? "border-sky-text ring-2 ring-sky/25" : "border-line hover:border-line-strong",
        )}
      />
      {active || qa.text ? null : (
        <span className="pointer-events-none absolute top-5 right-12 hidden -translate-y-1/2 lg:inline-flex">
          <Kbd>N</Kbd>
        </span>
      )}
      <div className="absolute top-5 right-1 -translate-y-1/2">
        <IconButton
          icon={ReceiptText}
          label={receipt.canRead ? "Scan a receipt" : "Attach a receipt"}
          size="sm"
          disabled={receipt.scanning}
          aria-busy={receipt.scanning || undefined}
          className={receipt.scanning ? "animate-pulse" : undefined}
          onClick={() => file.current?.click()}
        />
      </div>
      <input
        ref={file}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          takeFile(event.target.files);
          event.target.value = "";
        }}
      />
      {showPreview ? (
        <QuickAddPreview
          qa={qa}
          summaryId={summaryId}
          canSave={Boolean(requests)}
          saving={saving}
          onSave={() => void save()}
          onMore={openFull}
        />
      ) : null}
    </div>
  );
}

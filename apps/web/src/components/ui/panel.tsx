import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useState } from "react";
import { Button } from "./button";
import { cx } from "./cx";
import { IconButton } from "./icon-button";
import { useIsWide } from "./use-media";

export interface PanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Read by screen readers under the title. */
  description?: string;
  /** Pinned at the foot: the panel's action. */
  footer?: ReactNode;
  /** Something typed would be lost: closing asks once. */
  dirty?: boolean;
  /** Extra controls beside the close button (a delete, a menu). */
  headerActions?: ReactNode;
  children: ReactNode;
  width?: "md" | "lg";
}

/**
 * Creating and editing happen here. On a wide screen it slides in from the right
 * over the content with no backdrop, so the list stays visible and clickable; on a
 * phone it is a full-height sheet. Escape or the close button shut it.
 */
export function Panel({
  open,
  onClose,
  title,
  description,
  footer,
  dirty,
  headerActions,
  children,
  width = "md",
}: PanelProps) {
  const wide = useIsWide();
  const [confirming, setConfirming] = useState(false);
  const requestClose = () => {
    if (dirty && !confirming) setConfirming(true);
    else {
      setConfirming(false);
      onClose();
    }
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) requestClose();
      }}
      modal={!wide}
    >
      <Dialog.Portal>
        {!wide ? <Dialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-ink/30" /> : null}
        <Dialog.Content
          aria-describedby={description ? undefined : undefined}
          onInteractOutside={(event) => {
            // Clicking the list behind opens another item; it never closes this one.
            if (wide) event.preventDefault();
          }}
          className={cx(
            "fixed z-40 flex flex-col bg-card shadow-2xl shadow-ink/15 outline-none",
            wide
              ? cx(
                  "top-2 right-2 bottom-2 animate-panel-in rounded-3xl border border-line",
                  width === "lg"
                    ? "w-[min(560px,calc(100vw-1rem))]"
                    : "w-[min(440px,calc(100vw-1rem))]",
                )
              : "inset-x-0 top-6 bottom-0 animate-sheet-in rounded-t-3xl",
          )}
        >
          <header className="flex items-center gap-2 px-5 pt-4 pb-2">
            <Dialog.Title className="min-w-0 flex-1 truncate text-title">{title}</Dialog.Title>
            {headerActions}
            <IconButton icon={X} label="Close" shortcut="Esc" onClick={requestClose} />
          </header>
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">{children}</div>
          {confirming ? (
            <div
              role="alertdialog"
              aria-label="Discard changes?"
              className="flex items-center gap-2 border-t border-line px-5 py-3"
            >
              <p className="flex-1 text-callout font-semibold">Discard your changes?</p>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Keep editing
              </Button>
              <Button size="sm" variant="danger" onClick={requestClose}>
                Discard
              </Button>
            </div>
          ) : footer ? (
            <footer className="flex items-center gap-2 border-t border-line px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

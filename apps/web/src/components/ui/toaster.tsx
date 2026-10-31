import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { toastStore } from "@/lib/toast";
import { cx } from "./cx";

const SHOW_MS = { info: 8_000, error: 10_000 };

/** One toast at a time, bottom left on a wide screen, above the tab bar on a phone. */
export function Toaster() {
  const toast = useStore(toastStore);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!toast || paused) return;
    timer.current = setTimeout(() => toastStore.set(null), SHOW_MS[toast.tone]);
    return () => clearTimeout(timer.current);
  }, [toast, paused]);

  return (
    <div
      aria-live={toast?.tone === "error" ? "assertive" : "polite"}
      className="pointer-events-none fixed inset-x-3 bottom-24 z-50 flex justify-center sm:right-auto sm:bottom-5 sm:left-5 sm:justify-start"
    >
      {toast ? (
        <div
          key={toast.id}
          role="status"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
          className={cx(
            "pointer-events-auto flex max-w-[min(520px,100%)] animate-toast-in items-center gap-3 rounded-2xl bg-ink py-2.5 pr-2 pl-4 text-callout text-background shadow-xl shadow-ink/20",
          )}
        >
          <p className="flex-1 font-semibold">{toast.message}</p>
          {toast.secondLabel && toast.onSecond ? (
            <button
              type="button"
              onClick={() => {
                toast.onSecond?.();
                toastStore.set(null);
              }}
              className="rounded-lg px-2.5 py-1 font-extrabold text-mango-inverse hover:bg-background/10"
            >
              {toast.secondLabel}
            </button>
          ) : null}
          {toast.actionLabel && toast.onAction ? (
            <button
              type="button"
              onClick={() => {
                toast.onAction?.();
                toastStore.set(null);
              }}
              className="rounded-lg px-2.5 py-1 font-extrabold text-mango-inverse hover:bg-background/10"
            >
              {toast.actionLabel}
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => toastStore.set(null)}
            className="rounded-lg p-1 text-background/70 hover:bg-background/10 hover:text-background"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

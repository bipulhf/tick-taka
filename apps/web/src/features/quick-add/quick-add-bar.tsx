import { Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { useStore } from "@/lib/store";
import { quickAddFocusStore } from "@/lib/ui-state";

/** The top bar's capture field: one field, Enter saves. */
export function QuickAddBar() {
  const input = useRef<HTMLInputElement>(null);
  const focusRequest = useStore(quickAddFocusStore);
  useEffect(() => {
    if (focusRequest) input.current?.focus();
  }, [focusRequest]);
  return (
    <div className="relative mx-auto w-full max-w-[640px]">
      <Plus
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted"
      />
      <input
        ref={input}
        aria-label="Quick add"
        placeholder="Add anything: cha 20, 2h thesis, call bank tomorrow 5pm"
        className="h-10 w-full rounded-2xl border border-line bg-card pr-4 pl-10 text-body outline-none placeholder:text-muted focus:border-sky-text focus:ring-2 focus:ring-sky/25"
      />
    </div>
  );
}

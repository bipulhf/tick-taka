import type { ReactNode } from "react";

/** A keyboard key, as in the shortcuts list. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong/60 bg-background px-1 font-sans text-[0.6875rem] font-bold text-muted">
      {children}
    </kbd>
  );
}

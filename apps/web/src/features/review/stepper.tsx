import { Check } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Kbd } from "@/components/ui/kbd";
import { isTypingTarget } from "@/lib/ui-state";

export interface Step {
  label: string;
  /** A short state beside the step's name ("3 done", "2/3"). */
  hint?: string;
}

/**
 * ← and → (or [ and ]) move between steps, 1 to 9 jump to one, anywhere outside a
 * text field, a panel or a radio group (whose arrows are its own).
 */
export function useStepKeys(step: number, count: number, onStep: (step: number) => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[role=dialog],[role=radiogroup],[role=menu],[role=listbox]")) return;
      const key = event.key;
      let next: number | null = null;
      if (key === "ArrowRight" || key === "]") next = step + 1;
      else if (key === "ArrowLeft" || key === "[") next = step - 1;
      else if (/^[1-9]$/.test(key)) next = Number(key) - 1;
      if (next === null || next < 0 || next >= count || next === step) return;
      event.preventDefault();
      onStep(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, count, onStep]);
}

/**
 * A guided flow: on a desk the steps are listed down the left, each one a button;
 * on a phone they shrink to a row of bars over the step. The current step's body
 * and the Back / Next buttons sit on the right.
 */
export function Stepper({
  steps,
  step,
  onStep,
  label,
  children,
  footer,
}: {
  steps: Step[];
  step: number;
  onStep: (step: number) => void;
  /** Names the list of steps for screen readers ("Shutdown steps"). */
  label: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  useStepKeys(step, steps.length, onStep);
  const current = steps[step];
  return (
    <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label={label} className="lg:sticky lg:top-6">
        <ol className="hidden flex-col gap-1 lg:flex">
          {steps.map((item, index) => {
            const on = index === step;
            const past = index < step;
            return (
              <li key={item.label}>
                <button
                  type="button"
                  aria-current={on ? "step" : undefined}
                  onClick={() => onStep(index)}
                  className={cx(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150",
                    on ? "bg-card" : "hover:bg-line/40",
                  )}
                >
                  <span
                    aria-hidden
                    className={cx(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-caption tabular",
                      on
                        ? "bg-ink text-background"
                        : past
                          ? "bg-line text-ink"
                          : "border border-line-strong text-muted",
                    )}
                  >
                    {past ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={cx("block truncate text-callout font-bold", !on && "text-ink")}
                    >
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="block truncate text-caption text-muted">{item.hint}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="flex flex-col gap-2 lg:hidden">
          <div className="flex gap-1" aria-hidden>
            {steps.map((item, index) => (
              <span
                key={item.label}
                className={cx("h-1.5 flex-1 rounded-full", index <= step ? "bg-ink" : "bg-line")}
              />
            ))}
          </div>
          <p className="text-caption text-muted">
            Step {step + 1} of {steps.length}
          </p>
        </div>
        <p className="mt-4 hidden items-center gap-1.5 px-2.5 text-caption text-muted lg:flex">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
          move between steps
        </p>
      </nav>
      <div className="flex min-w-0 flex-col gap-5">
        <h2 className="text-title" aria-live="polite">
          {current?.label}
        </h2>
        {children}
        <div className="flex flex-wrap items-center gap-2 pt-2">{footer}</div>
      </div>
    </div>
  );
}

/** Back and Next under a step; the last step's action replaces Next. */
export function StepButtons({
  step,
  count,
  onStep,
  finish,
}: {
  step: number;
  count: number;
  onStep: (step: number) => void;
  finish: ReactNode;
}) {
  return (
    <>
      {step > 0 ? (
        <Button variant="secondary" onClick={() => onStep(step - 1)}>
          Back
        </Button>
      ) : null}
      {step < count - 1 ? (
        <Button variant="primary" onClick={() => onStep(step + 1)}>
          Next
        </Button>
      ) : (
        finish
      )}
    </>
  );
}

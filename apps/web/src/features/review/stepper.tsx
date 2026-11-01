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

/** The steps across the top on a tablet or desk: a bar, a number (a tick once passed), the name. */
function StepList({
  steps,
  step,
  onStep,
}: {
  steps: Step[];
  step: number;
  onStep: (step: number) => void;
}) {
  return (
    <ol
      className="hidden gap-2 md:grid"
      style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
    >
      {steps.map((item, index) => {
        const on = index === step;
        const past = index < step;
        return (
          <li key={item.label} className="min-w-0">
            <button
              type="button"
              aria-current={on ? "step" : undefined}
              onClick={() => onStep(index)}
              className={cx(
                "flex w-full flex-col gap-2.5 rounded-xl px-3 pt-0 pb-2.5 text-left transition-colors duration-150",
                on ? "bg-card" : "hover:bg-line/40",
              )}
            >
              <span
                aria-hidden
                className={cx(
                  "h-1 w-full rounded-full",
                  on || past ? "bg-ink" : "bg-line-strong/40",
                )}
              />
              <span className="flex min-w-0 items-center gap-2.5">
                {/* The number gives way below 1280 px, so the step's name has the room. */}
                <span
                  aria-hidden
                  className={cx(
                    "hidden size-7 shrink-0 items-center justify-center rounded-full text-caption tabular xl:flex",
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
                    className={cx(
                      "line-clamp-2 text-callout font-bold",
                      !on && !past && "text-muted",
                    )}
                  >
                    {past ? (
                      <Check
                        aria-hidden
                        className="mr-1 inline size-3.5 align-[-2px] xl:hidden"
                        strokeWidth={3}
                      />
                    ) : null}
                    {item.label}
                  </span>
                  {item.hint ? (
                    <span className="block truncate text-caption text-muted">{item.hint}</span>
                  ) : null}
                </span>
              </span>
              <span className="sr-only">{past ? "(done)" : on ? "(current step)" : ""}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A guided flow: the steps across the top (a row of bars on a phone), then the
 * current step's numbers and body, and Back / Next in a bar pinned to the bottom of
 * the view, so they stay in reach however long the step is.
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
    <div className="flex flex-col gap-6">
      <nav aria-label={label}>
        <StepList steps={steps} step={step} onStep={onStep} />
        <div className="flex gap-1 md:hidden" aria-hidden>
          {steps.map((item, index) => (
            <span
              key={item.label}
              className={cx("h-1.5 flex-1 rounded-full", index <= step ? "bg-ink" : "bg-line")}
            />
          ))}
        </div>
      </nav>
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-0.5 px-1">
          <p className="text-caption text-muted md:hidden">
            Step {step + 1} of {steps.length}
          </p>
          <h2 className="text-title" aria-live="polite">
            {current?.label}
          </h2>
        </div>
        {children}
      </div>
      <div className="sticky bottom-24 z-10 flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-line bg-card p-2 shadow-lg shadow-ink/5 sm:bottom-4">
        <p className="mr-auto hidden items-center gap-1.5 px-2 text-caption text-muted md:flex">
          <span className="tabular">
            Step {step + 1} of {steps.length}
          </span>
          <span aria-hidden>·</span>
          <Kbd>←</Kbd>
          <Kbd>→</Kbd>
          to move
        </p>
        {footer}
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

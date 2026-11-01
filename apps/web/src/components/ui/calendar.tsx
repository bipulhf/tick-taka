import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { type ComponentProps, useEffect, useRef } from "react";
import { type DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";
import { cx } from "./cx";

/**
 * shadcn/ui's Calendar (react-day-picker) in the app's tokens: Nunito, tabular
 * digits, 40 px days with rounded corners, the chosen day in ink with background
 * text like a selected chip (never mango), today marked by a small dot. Day numbers
 * stay 0-9, as every date does. Light and dark come from the tokens.
 */
export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: ComponentProps<typeof DayPicker>) {
  const defaults = getDefaultClassNames();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cx("w-fit p-3 text-ink [--cell-size:2.5rem]", className)}
      classNames={{
        root: cx("w-fit", defaults.root),
        months: cx("relative flex flex-col gap-4", defaults.months),
        month: cx("flex w-full flex-col gap-3", defaults.month),
        nav: cx(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaults.nav,
        ),
        button_previous: cx(navButton, defaults.button_previous),
        button_next: cx(navButton, defaults.button_next),
        month_caption: cx(
          "flex h-(--cell-size) w-full items-center justify-center px-(--cell-size)",
          defaults.month_caption,
        ),
        caption_label: cx("text-callout font-bold select-none", defaults.caption_label),
        month_grid: "w-full border-collapse",
        weekdays: cx("flex", defaults.weekdays),
        weekday: cx("w-(--cell-size) flex-1 text-caption text-muted select-none", defaults.weekday),
        week: cx("mt-1 flex w-full", defaults.week),
        day: cx("relative size-(--cell-size) p-0 text-center select-none", defaults.day),
        today: defaults.today,
        outside: cx("text-muted", defaults.outside),
        disabled: cx("opacity-40", defaults.disabled),
        hidden: cx("invisible", defaults.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...rootProps }) => (
          <div data-slot="calendar" ref={rootRef} className={className} {...rootProps} />
        ),
        Chevron: ({ className, orientation }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "right"
                ? ChevronRight
                : orientation === "up"
                  ? ChevronUp
                  : ChevronDown;
          return <Icon aria-hidden className={cx("size-4", className)} />;
        },
        DayButton: CalendarDayButton,
        ...components,
      }}
      {...props}
    />
  );
}

const navButton =
  "flex size-(--cell-size) items-center justify-center rounded-xl text-muted transition-colors duration-150 select-none hover:bg-line/60 hover:text-ink aria-disabled:pointer-events-none aria-disabled:opacity-40";

/** One day: a rounded square, ink-filled when chosen, with a dot under today's number. */
export function CalendarDayButton({
  className,
  day,
  modifiers,
  children,
  ...props
}: ComponentProps<typeof DayButton>) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (modifiers.focused) ref.current?.focus({ preventScroll: true });
  }, [modifiers.focused]);
  return (
    <button
      ref={ref}
      type="button"
      data-selected={modifiers.selected || undefined}
      data-today={modifiers.today || undefined}
      className={cx(
        "relative flex size-full items-center justify-center rounded-xl text-callout font-semibold tabular transition-colors duration-150 focus-visible:outline-offset-0 disabled:cursor-default",
        modifiers.selected
          ? "bg-ink text-background"
          : modifiers.outside
            ? "text-muted hover:bg-line/60"
            : "text-ink hover:bg-line/60",
        modifiers.today && "font-extrabold",
        className,
      )}
      {...props}
    >
      {children}
      {modifiers.today ? (
        <span aria-hidden className="absolute bottom-1 size-1 rounded-full bg-current" />
      ) : null}
    </button>
  );
}

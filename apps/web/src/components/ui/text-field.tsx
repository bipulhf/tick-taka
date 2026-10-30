import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, useId } from "react";
import { cx } from "./cx";

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-card px-3 text-body text-ink placeholder:text-muted/80 transition-colors duration-150 hover:border-ink/60 focus:border-sky-text focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-sky/25 disabled:opacity-60 aria-invalid:border-coral-text";

/** A label above the control, an optional hint or error below it. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={htmlFor} className="text-caption text-muted">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <p role="alert" className="text-caption text-coral-text">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption font-normal text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string | null;
  /** Text shown inside the field before the value, such as ৳. */
  prefix?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, prefix, className, id, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={cx(inputClass, "h-10", prefix && "pl-8")}
          {...props}
        />
      </div>
    </Field>
  );
});

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string | null;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, className, id, rows = 3, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <Field label={label} hint={hint} error={error} htmlFor={inputId} className={className}>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cx(inputClass, "resize-y py-2")}
        {...props}
      />
    </Field>
  );
});

import { toBanglaDigits } from "@tick-taka/shared/digits";
import type { AssistantQuestion, AssistantQuestionField } from "@tick-taka/shared/schemas/ai";
import type { AssistantPickerType } from "@tick-taka/shared/tiki-answers";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DateField, TimeField } from "@/components/ui/date-field";
import { NONE, Select, type SelectOption } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { numeralsStore } from "@/lib/format";
import { useAccounts, useAreas, useCategories, useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { AmountField } from "../money/amount-field";
import { categoryOptions } from "../money/transaction-filters";
import {
  blockingFields,
  formMessage,
  initialFormState,
  type QuestionFormState,
  unreadableAmounts,
} from "./question-form";

type PickerField = Extract<AssistantQuestionField, { type: AssistantPickerType }>;
type ChoiceField = Extract<AssistantQuestionField, { type: "choice" }>;

interface Pickers {
  /** The records a picker field lists; a category field may be narrowed to one kind. */
  optionsFor: (field: PickerField) => SelectOption<string>[];
  nameOf: (type: AssistantPickerType, id: string) => string | undefined;
}

const labelOf = (field: AssistantQuestionField) =>
  field.required ? field.label : `${field.label} (optional)`;

/** The user's own accounts, categories and areas, for the pickers and the answer's names. */
function usePickers(): Pickers {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const records: Record<AssistantPickerType, { id: string; name: string }[]> = {
    account: accounts,
    category: categories,
    area: areas,
  };
  return {
    optionsFor: (field) => {
      if (field.type === "category") return categoryOptions(categories, field.options?.[0]?.value);
      if (field.type === "area")
        return areas.map((a) => ({ value: a.id, label: a.name, leading: a.emoji }));
      return accounts.map((a) => ({ value: a.id, label: a.name }));
    },
    nameOf: (type, id) => records[type].find((record) => record.id === id)?.name,
  };
}

/** One pick of a few, as chips; an optional one can be clicked again to clear it. */
function ChoiceChips({
  field,
  value,
  onChange,
}: {
  field: ChoiceField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-caption text-muted">{labelOf(field)}</legend>
      <div className="flex flex-wrap gap-2">
        {field.options.map((option) => (
          <Chip
            key={option.value}
            selected={value === option.value}
            onClick={() => onChange(value === option.value && !field.required ? "" : option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

/** One field with the app's own input for its type. */
function QuestionField({
  field,
  value,
  onChange,
  currency,
  pickers,
  unreadable,
}: {
  field: AssistantQuestionField;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  pickers: Pickers;
  unreadable: boolean;
}) {
  const bangla = useStore(numeralsStore) === "beng";
  const label = labelOf(field);
  switch (field.type) {
    case "choice":
      return <ChoiceChips field={field} value={value} onChange={onChange} />;
    case "text":
      return (
        <TextField
          label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder}
          maxLength={80}
          autoComplete="off"
        />
      );
    case "amount":
      return (
        <AmountField
          label={label}
          value={value}
          onChange={onChange}
          currency={currency}
          placeholder={field.placeholder ?? (bangla ? toBanglaDigits("0") : "0")}
          error={unreadable ? "That doesn't read as an amount" : null}
        />
      );
    case "date":
      return (
        <DateField
          label={label}
          value={value || null}
          onChange={(date) => onChange(date ?? "")}
          clearable={!field.required}
        />
      );
    case "time":
      return (
        <TimeField label={label} value={value || null} onChange={(time) => onChange(time ?? "")} />
      );
    default: {
      const options = pickers.optionsFor(field);
      return (
        <Select
          label={label}
          value={value || (field.required ? null : NONE)}
          options={field.required ? options : [{ value: NONE, label: "None" }, ...options]}
          onChange={(id) => onChange(id === NONE ? "" : id)}
          placeholder={field.placeholder ?? "Choose"}
        />
      );
    }
  }
}

/** The small form itself: fields prefilled with Tiki's defaults, Send once the required ones are in. */
function QuestionForm({
  question,
  busy,
  onAnswer,
}: {
  question: AssistantQuestion;
  busy: boolean;
  onAnswer: (text: string) => void;
}) {
  const { data: settings } = useSettings();
  const numerals = useStore(numeralsStore);
  const currency = settings?.defaultCurrency ?? "BDT";
  const pickers = usePickers();
  const [state, setState] = useState<QuestionFormState>(() =>
    initialFormState(question, { currency, numerals }),
  );
  const blocked = blockingFields(question, state, currency);
  const unreadable = new Set(unreadableAmounts(question, state, currency));
  const waitingFor = question.fields
    .filter((field) => blocked.includes(field.key) && !unreadable.has(field.key))
    .map((field) => field.label);
  const hintId = useId();

  const submit = () => {
    if (busy || blocked.length) return;
    onAnswer(formMessage(question, state, { currency, nameOf: pickers.nameOf }));
  };

  return (
    <form
      aria-label={question.question}
      className="w-full rounded-2xl border border-line-strong bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3 disabled:opacity-60">
        {question.fields.map((field) => (
          <QuestionField
            key={field.key}
            field={field}
            value={state[field.key] ?? ""}
            onChange={(value) => setState((current) => ({ ...current, [field.key]: value }))}
            currency={currency}
            pickers={pickers}
            unreadable={unreadable.has(field.key)}
          />
        ))}
        <div className="flex items-center gap-3 pt-1">
          <p id={hintId} className="min-w-0 flex-1 text-caption text-muted">
            {waitingFor.length ? `Fill in ${waitingFor.join(", ")} to send` : null}
          </p>
          <Button
            type="submit"
            variant="primary"
            disabled={blocked.length > 0}
            aria-describedby={waitingFor.length ? hintId : undefined}
          >
            {question.submitLabel ?? "Send"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

/**
 * Tiki's question as a small form under its message. Shown only while it can still
 * be answered; the answer itself shows as the user's message.
 */
export function QuestionCard({
  question,
  busy,
  onAnswer,
}: {
  question: AssistantQuestion;
  busy: boolean;
  onAnswer: (text: string) => void;
}) {
  return <QuestionForm question={question} busy={busy} onAnswer={onAnswer} />;
}

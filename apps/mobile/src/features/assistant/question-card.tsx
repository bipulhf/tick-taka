import type { AssistantQuestion } from "@tick-taka/shared/schemas/ai";
import {
  type AssistantAnswers,
  isQuickReply,
  missingRequired,
} from "@tick-taka/shared/tiki-answers";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { useAccounts, useAreas, useCategories, useSettings } from "@/lib/queries";
import { QuestionField } from "./question-fields";
import { type FormRecords, formAnswer, initialAnswers } from "./question-form";
import type { FieldScroll } from "./use-chat-scroll";

/** "Name", "Name and Amount", "Name, Type and Amount". */
function listOf(labels: string[]): string {
  return labels.length < 2
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

/**
 * Tiki's question as a small form under its message, prefilled with what it
 * already knows. Send waits for the required fields and sends the answers as the
 * user's next message, the same way a typed one goes. A single choice is a quick
 * reply: tapping an option sends it. Once answered (`open` false) the card folds
 * away and the answers read in the user's message below; it stays mounted, so a
 * send that failed comes back filled in.
 */
export function QuestionCard({
  question,
  open,
  busy,
  onAnswer,
  scroll,
}: {
  question: AssistantQuestion;
  /** Only the latest unanswered question takes answers. */
  open: boolean;
  /** Tiki is working on a turn. */
  busy: boolean;
  onAnswer: (text: string) => void;
  scroll: FieldScroll;
}) {
  const [values, setValues] = useState<AssistantAnswers>(() => initialAnswers(question));
  const [keypad, setKeypad] = useState<string | null>(null);
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  if (!open) return null;

  const currency = settings?.defaultCurrency;
  const records: FormRecords = { account: accounts, category: categories, area: areas };
  const answer = (given: AssistantAnswers) => {
    if (busy) return;
    setKeypad(null);
    onAnswer(formAnswer(question, given, { currency, records }));
  };

  const [only] = question.fields;
  if (isQuickReply(question) && only?.type === "choice")
    return (
      <View className="flex-row flex-wrap gap-2">
        {only.options.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            choice="action"
            onPress={busy ? undefined : () => answer({ [only.key]: option.value })}
          />
        ))}
      </View>
    );

  const missing = missingRequired(question, values);
  const missingLabels = question.fields
    .filter((field) => missing.includes(field.key))
    .map((field) => field.label);
  return (
    <View className="w-full gap-4 rounded-2xl border border-line-strong bg-card p-4">
      {question.fields.map((field) => (
        <QuestionField
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(value) => setValues((all) => ({ ...all, [field.key]: value }))}
          currency={currency}
          keypad={keypad}
          onKeypad={setKeypad}
          scroll={scroll}
        />
      ))}
      <View className="gap-2">
        {missingLabels.length ? (
          <Text variant="caption" tone="muted">
            Fill in {listOf(missingLabels)} to send.
          </Text>
        ) : null}
        <Button
          label={question.submitLabel ?? "Send"}
          disabled={busy || missing.length > 0}
          onPress={() => answer(values)}
        />
      </View>
    </View>
  );
}

import { useNavigate } from "@tanstack/react-router";
import type { AiFeature } from "@tick-taka/shared/schemas/settings";
import { AI_FEATURES } from "@tick-taka/shared/schemas/settings";
import { BarChart3 } from "lucide-react";
import { Group, Row, RowMark } from "@/components/ui/group";
import { ToggleRow } from "@/components/ui/toggle";
import { useAiStatus } from "@/lib/queries";
import { MoreOptions } from "./setting-row";
import type { SectionProps } from "./settings-types";
import { TikiNotes } from "./tiki-notes";

/** What each feature is called. */
const AI_LABELS: Partial<Record<AiFeature, string>> = {
  assistant: "Chat with Tiki (and voice)",
  parse: "Smart quick-add",
  receipt: "Receipt scan",
  categorize: "Auto-categorise",
  planDay: "Plan my day",
  breakdown: "Break it down",
  weeklyReview: "Weekly coach",
  budgetSuggestions: "Budget suggestions",
};

export const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/** One switch for all AI, each feature folded under it, and what it cost this month. */
export function AiSection({ s, update }: SectionProps) {
  const navigate = useNavigate();
  const ai = useAiStatus();
  // In the phone's order (the chat first); a feature without a label isn't offered.
  const features = (Object.keys(AI_LABELS) as AiFeature[]).filter((f) => AI_FEATURES.includes(f));
  return (
    <>
      {ai.data && !ai.data.configured ? (
        <p className="px-1 text-callout text-muted">
          AI isn't set up on the server (OPENAI_API_KEY).
        </p>
      ) : null}
      <Group>
        <ToggleRow
          label="AI features"
          description="Tiki's chat, smart quick-add, receipt scan and more. One switch turns them all off."
          checked={s.ai.enabled}
          onChange={(on) => update({ ai: { ...s.ai, enabled: on } })}
        />
      </Group>
      {s.ai.enabled ? (
        <MoreOptions
          label={`Choose features (${features.filter((f) => s.ai.features[f] !== false).length} of ${features.length} on)`}
        >
          <Group>
            {features.map((feature) => (
              <ToggleRow
                key={feature}
                label={AI_LABELS[feature] ?? feature}
                checked={s.ai.features[feature] !== false}
                onChange={(on) =>
                  update({ ai: { ...s.ai, features: { ...s.ai.features, [feature]: on } } })
                }
              />
            ))}
          </Group>
        </MoreOptions>
      ) : null}
      {s.ai.enabled ? <TikiNotes s={s} update={update} /> : null}
      {ai.data ? (
        <Group>
          <Row
            leading={<RowMark icon={BarChart3} />}
            title={`${dollars(ai.data.monthSpendMicros)} this month`}
            subtitle={
              ai.data.monthlyCapMicros === null
                ? "Day by day and per feature"
                : `Limit ${dollars(ai.data.monthlyCapMicros)} a month, set on the server`
            }
            chevron
            onClick={() => void navigate({ to: "/review/ai-usage" })}
          />
        </Group>
      ) : null}
    </>
  );
}

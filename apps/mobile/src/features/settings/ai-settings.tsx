import { useRouter } from "expo-router";
import { Card } from "@/components/ui/card";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Text } from "@/components/ui/text";
import { ToggleRow } from "@/components/ui/toggle-row";
import { useAiStatus } from "@/lib/queries";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

const AI_LABELS = {
  assistant: "Chat with Tiki (and voice)",
  parse: "Smart quick-add",
  receipt: "Receipt scan",
  categorize: "Auto-categorise",
  planDay: "Plan my day",
  breakdown: "Break it down",
  weeklyReview: "Weekly coach",
  budgetSuggestions: "Budget suggestions",
} as const;

export const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/** One switch for all AI, one per feature, and what it cost this month. */
export function AiSettings() {
  const router = useRouter();
  const ai = useAiStatus();
  const update = useUpdateSettings();
  return (
    <SettingsPage title="AI">
      {(s) => (
        <>
          {!ai.data?.configured ? (
            <Text tone="muted">AI isn't set up on the server (OPENAI_API_KEY).</Text>
          ) : null}
          <Card className="gap-1">
            <ToggleRow
              label="AI features"
              hint="One switch turns every AI feature off"
              value={s.ai.enabled}
              onChange={(on) => update({ ai: { ...s.ai, enabled: on } })}
            />
            {s.ai.enabled
              ? (Object.keys(AI_LABELS) as (keyof typeof AI_LABELS)[]).map((feature) => (
                  <ToggleRow
                    key={feature}
                    label={AI_LABELS[feature]}
                    value={s.ai.features[feature] !== false}
                    onChange={(on) =>
                      update({ ai: { ...s.ai, features: { ...s.ai.features, [feature]: on } } })
                    }
                  />
                ))
              : null}
          </Card>
          {ai.data ? (
            <Group inset={60}>
              <ListRow
                icon="chart-bar"
                iconColor="muted"
                title={`${dollars(ai.data.monthSpendMicros)} this month`}
                subtitle={
                  ai.data.monthlyCapMicros === null
                    ? "Day by day and per feature"
                    : `Limit ${dollars(ai.data.monthlyCapMicros)} a month, set on the server`
                }
                chevron
                onPress={() => router.push("/review/ai-usage")}
              />
            </Group>
          ) : null}
        </>
      )}
    </SettingsPage>
  );
}

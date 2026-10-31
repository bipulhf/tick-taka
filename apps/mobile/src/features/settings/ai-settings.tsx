import { AI_GROUPS, isAiGroupOn, setAiGroup } from "@tick-taka/shared/ai-groups";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/card";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Text } from "@/components/ui/text";
import { ToggleRow } from "@/components/ui/toggle-row";
import { useAiStatus } from "@/lib/queries";
import { SettingsPage } from "./settings-page";
import { TikiNotes } from "./tiki-notes";
import { useUpdateSettings } from "./use-update-settings";

export const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/**
 * One switch for all AI, three group switches (each sets the server's flags for the
 * features in it), what Tiki remembers and what it cost this month.
 */
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
              ? AI_GROUPS.map((group) => (
                  <ToggleRow
                    key={group.id}
                    label={group.label}
                    hint={group.hint}
                    value={isAiGroupOn(s.ai.features, group.id)}
                    onChange={(on) =>
                      update({
                        ai: { ...s.ai, features: setAiGroup(s.ai.features, group.id, on) },
                      })
                    }
                  />
                ))
              : null}
          </Card>
          <TikiNotes notes={s.tikiNotes} />
          {ai.data ? (
            <Group inset={60}>
              <ListRow
                icon="chart-bar"
                iconColor="muted"
                title="AI cost"
                subtitle={
                  ai.data.monthlyCapMicros === null
                    ? `${dollars(ai.data.monthSpendMicros)} this month`
                    : `${dollars(ai.data.monthSpendMicros)} this month, limit ${dollars(ai.data.monthlyCapMicros)}`
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

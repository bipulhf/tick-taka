import { useNavigate } from "@tanstack/react-router";
import { AI_GROUPS, isAiGroupOn, setAiGroup } from "@tick-taka/shared/ai-groups";
import { BarChart3 } from "lucide-react";
import { Group, Row, RowMark } from "@/components/ui/group";
import { ToggleRow } from "@/components/ui/toggle";
import { useAiStatus } from "@/lib/queries";
import type { SectionProps } from "./settings-types";
import { TikiNotes } from "./tiki-notes";

export const dollars = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`;

/**
 * One switch for all AI, three group switches under it (each sets the server's flags
 * for the features in it), and what it cost this month.
 */
export function AiSection({ s, update }: SectionProps) {
  const navigate = useNavigate();
  const ai = useAiStatus();
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
        <Group>
          {AI_GROUPS.map((group) => (
            <ToggleRow
              key={group.id}
              label={group.label}
              description={group.hint}
              checked={isAiGroupOn(s.ai.features, group.id)}
              onChange={(on) =>
                update({ ai: { ...s.ai, features: setAiGroup(s.ai.features, group.id, on) } })
              }
            />
          ))}
        </Group>
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

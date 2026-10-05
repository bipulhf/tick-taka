import * as LocalAuthentication from "expo-local-authentication";
import { useRouter } from "expo-router";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/empty-state";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatMinutes } from "@/lib/format";
import { notify } from "@/lib/notify";
import { togglePrivacy, usePrivacy } from "@/lib/privacy";
import { useAccounts, useAiStatus, useSettings } from "@/lib/queries";
import { AccountSection } from "./account-section";
import { DataSection } from "./data-section";
import { ChoiceRow, ToggleRow } from "./setting-row";
import { useUpdateSettings } from "./use-update-settings";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const AI_LABELS = {
  parse: "Smart quick-add and SMS",
  receipt: "Receipt scan",
  categorize: "Auto-categorise",
  planDay: "Plan my day",
  breakdown: "Break it down",
  weeklyReview: "Weekly coach",
  assistant: "Chat with Tiki (and voice)",
  budgetSuggestions: "Budget suggestions",
} as const;
const CAPS = [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];

export function SettingsScreen() {
  const router = useRouter();
  const { data: s, isError, refetch } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const ai = useAiStatus();
  const privacy = usePrivacy();
  const update = useUpdateSettings();
  if (!s)
    return (
      <Screen title="Settings" tabBarPadding={false}>
        {isError ? <ErrorState onRetry={() => void refetch()} /> : <SkeletonForm fields={6} />}
      </Screen>
    );

  const enableLock = async (on: boolean) => {
    if (
      on &&
      !(
        (await LocalAuthentication.hasHardwareAsync()) &&
        (await LocalAuthentication.isEnrolledAsync())
      )
    ) {
      notify("Set up a fingerprint or face unlock on the phone first");
      return;
    }
    update({ appLock: on });
  };

  return (
    <Screen title="Settings" tabBarPadding={false}>
      <Section title="Account">
        <AccountSection />
      </Section>
      <Section title="Appearance">
        <Segmented<"system" | "light" | "dark">
          value={s.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </Section>
      <Section title="Today">
        <Card className="gap-1">
          <ChoiceRow label="Daily task goal">
            {[0, 3, 5, 7, 10].map((n) => (
              <Chip
                key={n}
                label={n === 0 ? "Off" : String(n)}
                selected={s.dailyTaskGoal === n}
                onPress={() => update({ dailyTaskGoal: n })}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Days off">
            {DAYS.map((day, i) => (
              <Chip
                key={day}
                label={day}
                tone="sky"
                selected={s.daysOff.includes(i)}
                onPress={() =>
                  update({
                    daysOff: s.daysOff.includes(i)
                      ? s.daysOff.filter((d) => d !== i)
                      : [...s.daysOff, i],
                  })
                }
              />
            ))}
          </ChoiceRow>
          <ToggleRow
            label="Vacation mode"
            hint="Pauses goals so streaks survive"
            value={s.vacationMode}
            onChange={(on) => update({ vacationMode: on })}
          />
          <ChoiceRow label="Free time on a working day">
            {[240, 360, 480, 600].map((m) => (
              <Chip
                key={m}
                label={formatMinutes(m)}
                tone="sky"
                selected={s.dayCapacityMinutes === m}
                onPress={() => update({ dayCapacityMinutes: m })}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Week starts on">
            {[6, 0, 1].map((d) => (
              <Chip
                key={d}
                label={DAYS[d]!}
                selected={s.weekStartsOn === d}
                onPress={() => update({ weekStartsOn: d })}
              />
            ))}
          </ChoiceRow>
        </Card>
      </Section>
      <Section title="Focus">
        <Card className="gap-1">
          <ChoiceRow label="Work">
            {[15, 25, 45, 50, 90].map((m) => (
              <Chip
                key={m}
                label={`${m}m`}
                tone="sky"
                selected={s.focus.workMinutes === m}
                onPress={() => update({ focus: { ...s.focus, workMinutes: m } })}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Break">
            {[5, 10, 15].map((m) => (
              <Chip
                key={m}
                label={`${m}m`}
                tone="sky"
                selected={s.focus.breakMinutes === m}
                onPress={() => update({ focus: { ...s.focus, breakMinutes: m } })}
              />
            ))}
          </ChoiceRow>
        </Card>
      </Section>
      <Section title="Money">
        <Card className="gap-1">
          <ChoiceRow label="Default account">
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                tone="mint"
                selected={s.defaultAccountId === a.id}
                onPress={() => update({ defaultAccountId: a.id })}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Cash account (for cash-outs)">
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                tone="mint"
                selected={s.cashAccountId === a.id}
                onPress={() => update({ cashAccountId: a.id })}
              />
            ))}
          </ChoiceRow>
          <ToggleRow
            label="Cost in hours"
            hint="Show big expenses as hours of work"
            value={s.costInHours}
            onChange={(on) => update({ costInHours: on })}
          />
          <ListRow
            title="SMS sources"
            subtitle={`${s.smsSources.length} sender${s.smsSources.length === 1 ? "" : "s"} mapped`}
            icon="message-text-outline"
            chevron
            onPress={() => router.push("/settings/sms")}
          />
          <ListRow
            title="Areas and categories"
            icon="shape-outline"
            chevron
            onPress={() => router.push("/settings/areas")}
          />
        </Card>
      </Section>
      <Section title="Advanced views">
        <Card className="gap-1">
          <ToggleRow
            label="Eisenhower matrix"
            value={s.advancedViews.eisenhower}
            onChange={(on) => update({ advancedViews: { ...s.advancedViews, eisenhower: on } })}
          />
          <ToggleRow
            label="Energy tags"
            value={s.advancedViews.energy}
            onChange={(on) => update({ advancedViews: { ...s.advancedViews, energy: on } })}
          />
          <ToggleRow
            label="Shopping list"
            value={s.advancedViews.shoppingList}
            onChange={(on) => update({ advancedViews: { ...s.advancedViews, shoppingList: on } })}
          />
        </Card>
      </Section>
      <Section title="Notifications">
        <Card className="gap-1">
          <ChoiceRow label="Quiet hours start">
            {["21:00", "22:00", "23:00", "00:00"].map((t) => (
              <Chip
                key={t}
                label={t}
                selected={s.quietHours.start === t}
                onPress={() => update({ quietHours: { ...s.quietHours, start: t } })}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Quiet hours end">
            {["06:00", "07:00", "08:00"].map((t) => (
              <Chip
                key={t}
                label={t}
                selected={s.quietHours.end === t}
                onPress={() => update({ quietHours: { ...s.quietHours, end: t } })}
              />
            ))}
          </ChoiceRow>
          <ChoiceRow label="Daily shutdown">
            {["20:30", "21:30", "22:30"].map((t) => (
              <Chip
                key={t}
                label={t}
                selected={s.shutdownTime === t}
                onPress={() => update({ shutdownTime: t })}
              />
            ))}
          </ChoiceRow>
        </Card>
      </Section>
      <Section title="Privacy and security">
        <Card className="gap-1">
          <ToggleRow
            label="Fingerprint lock"
            hint={`After ${s.lockAfterMinutes} minutes in the background`}
            value={s.appLock}
            onChange={enableLock}
          />
          <ToggleRow
            label="Privacy mode"
            hint="Hide every amount on screen"
            value={privacy}
            onChange={togglePrivacy}
          />
        </Card>
      </Section>
      <Section title="AI">
        <Card className="gap-1">
          {!ai.data?.configured ? (
            <Text tone="muted">AI isn't set up on the server (OPENAI_API_KEY).</Text>
          ) : null}
          <ToggleRow
            label="AI features"
            hint="One switch turns every AI feature off"
            value={s.ai.enabled}
            onChange={(on) => update({ ai: { ...s.ai, enabled: on } })}
          />
          {ai.data ? (
            <Text variant="caption" tone="muted">
              This month: ${(ai.data.monthSpendMicros / 1_000_000).toFixed(2)} of $
              {(ai.data.monthlyCapMicros / 1_000_000).toFixed(2)}
            </Text>
          ) : null}
          <ChoiceRow label="Monthly cap">
            {CAPS.filter((cap) => cap <= (ai.data?.maxCapMicros ?? Number.POSITIVE_INFINITY)).map(
              (cap) => (
                <Chip
                  key={cap}
                  label={`$${cap / 1_000_000}`}
                  selected={(ai.data?.monthlyCapMicros ?? s.ai.monthlyCapMicros) === cap}
                  onPress={() => update({ ai: { ...s.ai, monthlyCapMicros: cap } })}
                />
              ),
            )}
          </ChoiceRow>
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
      </Section>
      <Section title="Your data">
        <DataSection />
      </Section>
    </Screen>
  );
}

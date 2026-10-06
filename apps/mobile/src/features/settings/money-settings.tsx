import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { useAccounts } from "@/lib/queries";
import { ChoiceRow, ToggleRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

/** Which accounts money goes to by default, and cost in hours. */
export function MoneySettings() {
  const { data: accounts = [] } = useAccounts();
  const update = useUpdateSettings();
  return (
    <SettingsPage title="Money">
      {(s) => (
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
        </Card>
      )}
    </SettingsPage>
  );
}

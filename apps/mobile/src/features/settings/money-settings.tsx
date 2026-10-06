import { View } from "react-native";
import { Card } from "@/components/ui/card";
import { PickerField } from "@/components/ui/picker-field";
import { useAccounts } from "@/lib/queries";
import { ToggleRow } from "./setting-row";
import { SettingsPage } from "./settings-page";
import { useUpdateSettings } from "./use-update-settings";

/** Which accounts money goes to by default, and cost in hours. */
export function MoneySettings() {
  const { data: accounts = [] } = useAccounts();
  const update = useUpdateSettings();
  const options = accounts.map((a) => ({ id: a.id, label: a.name }));
  return (
    <SettingsPage title="Money">
      {(s) => (
        <Card className="gap-1">
          <View className="gap-3 py-1">
            <PickerField
              label="Default account"
              value={s.defaultAccountId}
              options={options}
              onChange={(id) => id && update({ defaultAccountId: id })}
            />
            <PickerField
              label="Cash account (for cash-outs)"
              value={s.cashAccountId}
              options={options}
              onChange={(id) => id && update({ cashAccountId: id })}
            />
          </View>
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

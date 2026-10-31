import { Group } from "@/components/ui/group";
import { ToggleRow } from "@/components/ui/toggle";
import { formatAmount, plural } from "@/lib/format";
import { useAccounts } from "@/lib/queries";
import { MoreOptions, SelectRow } from "./setting-row";
import type { SectionProps } from "./settings-types";

const CURRENCIES = ["BDT", "USD", "EUR", "GBP"];
const THRESHOLDS = [50_000, 100_000, 200_000, 500_000];
const GRACE_DAYS = [0, 1, 2, 3, 5, 7];

/**
 * Where money goes by default and in which currency; the cash account, cost in hours
 * and bill grace are folded under More options.
 */
export function MoneySection({ s, update }: SectionProps) {
  const { data: accounts = [] } = useAccounts();
  const options = accounts.map((a) => ({ value: a.id, label: a.name }));
  return (
    <>
      <Group>
        <SelectRow
          label="Default account"
          description="Quick-add uses it when you don't name one"
          value={s.defaultAccountId}
          options={options}
          onChange={(id) => update({ defaultAccountId: id })}
        />
        <SelectRow
          label="Currency"
          description="Budgets and safe to spend are in this currency"
          value={s.defaultCurrency}
          options={CURRENCIES.map((c) => ({ value: c, label: c }))}
          onChange={(defaultCurrency) => update({ defaultCurrency })}
        />
      </Group>

      <MoreOptions label="More options: cash account, cost in hours, bill grace">
        <Group>
          <SelectRow
            label="Cash account"
            description="Where cash-outs go"
            value={s.cashAccountId}
            options={options}
            onChange={(id) => update({ cashAccountId: id })}
          />
          <ToggleRow
            label="Cost in hours"
            description="Show big expenses as hours of work"
            checked={s.costInHours}
            onChange={(on) => update({ costInHours: on })}
          />
          {s.costInHours ? (
            <SelectRow
              label="Big means from"
              value={String(s.costInHoursThresholdMinor)}
              options={THRESHOLDS.map((minor) => ({
                value: String(minor),
                label: formatAmount(minor, { currency: s.defaultCurrency }),
              }))}
              onChange={(minor) => update({ costInHoursThresholdMinor: Number(minor) })}
            />
          ) : null}
          <SelectRow
            label="Grace for unpaid bills"
            description="Days after the due date before a bill counts as late"
            value={String(s.billOverdueGraceDays)}
            options={GRACE_DAYS.map((days) => ({
              value: String(days),
              label: days === 0 ? "None" : plural(days, "day"),
            }))}
            onChange={(days) => update({ billOverdueGraceDays: Number(days) })}
          />
        </Group>
      </MoreOptions>
    </>
  );
}

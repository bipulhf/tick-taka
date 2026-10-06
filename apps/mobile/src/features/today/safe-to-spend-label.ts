import { formatAmount } from "@tick-taka/shared/money";

export interface SafeToSpendNumbers {
  leftTodayMinor: number;
  spentTodayMinor: number;
  dailyMinor: number;
  daysLeft: number;
}

/**
 * What a screen reader says for the safe-to-spend card. A pressable card's label replaces
 * its content on Android, so the label has to carry the numbers itself.
 */
export function safeToSpendLabel(
  money: SafeToSpendNumbers,
  options: { hidden: boolean; paceAlert?: string | null },
): string {
  const over = money.leftTodayMinor < 0;
  const amount = (minor: number) => (options.hidden ? "amount hidden" : formatAmount(minor));
  const parts = [
    over
      ? `Over today's amount by ${amount(Math.abs(money.leftTodayMinor))}`
      : `Safe to spend today, ${amount(money.leftTodayMinor)}`,
    `${amount(money.spentTodayMinor)} spent of ${amount(money.dailyMinor)}`,
    `${money.daysLeft} ${money.daysLeft === 1 ? "day" : "days"} left`,
  ];
  if (options.paceAlert) parts.push(options.paceAlert);
  return `${parts.join(". ")}.`;
}

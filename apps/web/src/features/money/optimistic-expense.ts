import type { QueryClient } from "@tanstack/react-query";
import { type NewExpense, withNewExpense } from "@/lib/optimistic-spend";
import { keys, type TodayData } from "@/lib/queries";
import { updateToday } from "@/lib/today-cache";
import { userTime } from "@/lib/user-time";

/**
 * A just-logged expense comes off Today's safe-to-spend at once, as the phone's
 * outbox does for every POST /transactions of an expense. The refresh after the
 * write (or its failure) replaces the guess with the server's number.
 */
export function applyNewExpense(client: QueryClient, expense: NewExpense & { type: string }) {
  if (expense.type !== "expense") return;
  const categories =
    client.getQueryData<{ id: string; parentId: string | null; budgetType: string }[]>(
      keys.categories,
    ) ?? [];
  const settings = client.getQueryData<{
    timeZone: string;
    defaultCurrency: string;
    defaultAccountId: string | null;
  }>(keys.settings);
  // Only default-currency spending moves the number, as on the server.
  const currency = settings && {
    accounts: client.getQueryData<{ id: string; currency: string }[]>(keys.accounts) ?? [],
    defaultCurrency: settings.defaultCurrency,
    defaultAccountId: settings.defaultAccountId,
  };
  updateToday(client, (data: TodayData) =>
    withNewExpense(data, expense, categories, userTime(settings).timeZone, currency || undefined),
  );
}

import type { QueryClient } from "@tanstack/react-query";
import { type NewExpense, withNewExpense } from "@/lib/optimistic-spend";
import { keys, type TodayData } from "@/lib/queries";
import { updateToday } from "@/lib/today-cache";
import { userTime } from "@/lib/user-time";
import type { WriteRequest } from "@/lib/write";

/**
 * Takes a just-logged expense off today's safe-to-spend before the server answers,
 * as the phone does for every new expense. A failed write refreshes it back.
 */
export function applyOptimisticExpense(client: QueryClient, request: WriteRequest) {
  const body = request.body as (NewExpense & { type?: string }) | undefined;
  if (request.method !== "POST" || request.path !== "/transactions" || body?.type !== "expense")
    return;
  const categories = client.getQueryData<
    { id: string; parentId: string | null; budgetType: string }[]
  >(keys.categories);
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
  const { timeZone } = userTime(settings);
  updateToday(client, (data: TodayData) =>
    withNewExpense(data, body, categories ?? [], timeZone, currency || undefined),
  );
}

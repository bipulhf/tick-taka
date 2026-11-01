import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

/** Money's own queries, with the phone's keys (the first segment decides what refreshes). */

export type TransactionQuery = Omit<
  NonNullable<Parameters<typeof api.transactions.$get>[0]>["query"],
  "cursor"
>;

export function useTransactions(query: TransactionQuery, options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: ["transactions", query],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      unwrap(
        api.transactions.$get({ query: { ...query, ...(pageParam ? { cursor: pageParam } : {}) } }),
      ),
    getNextPageParam: (last) => last.nextCursor,
    enabled: options.enabled ?? true,
  });
}

/** How many pages of 200 the summary strip reads before it says "1,000+". */
const SUMMARY_PAGES = 5;

/**
 * Every transaction a filter matches (up to 1,000), for the summary strip's totals:
 * the list itself loads in pages, so its loaded items can't be added up.
 */
export function useTransactionsForSummary(query: TransactionQuery) {
  return useQuery({
    queryKey: ["transactions", "summary", query],
    queryFn: async () => {
      const items: Transaction[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < SUMMARY_PAGES; page++) {
        const result: { items: Transaction[]; nextCursor: string | null } = await unwrap(
          api.transactions.$get({
            query: { ...query, limit: "200", ...(cursor ? { cursor } : {}) },
          }),
        );
        items.push(...result.items);
        cursor = result.nextCursor;
        if (!cursor) break;
      }
      return { items, capped: cursor !== null };
    },
  });
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: ["transaction", id],
    queryFn: () => unwrap(api.transactions[":id"].$get({ param: { id: id ?? "" } })),
    enabled: Boolean(id),
  });
}

export function useBudgets(month: string) {
  return useQuery({
    queryKey: ["budgets", month],
    queryFn: () => unwrap(api.budgets.$get({ query: { month } })),
  });
}

/** "Plan next month": the month's limits from the three months before it (nothing saved). */
export function useBudgetSuggestion(month: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["budgets", "suggested", month],
    queryFn: () => unwrap(api.budgets.suggested.$get({ query: { month } })),
    enabled: options.enabled ?? true,
  });
}

export function useRecurring() {
  return useQuery({ queryKey: ["recurring"], queryFn: () => unwrap(api.recurring.$get()) });
}

/** Charges that look like subscriptions and aren't tracked as a bill yet. */
export function useSubscriptions() {
  return useQuery({
    queryKey: ["subscriptions"],
    queryFn: () => unwrap(api.insights.subscriptions.$get()),
  });
}

export function useGoals() {
  return useQuery({ queryKey: ["goals"], queryFn: () => unwrap(api.goals.$get()) });
}

export function useDebts() {
  return useQuery({ queryKey: ["debts"], queryFn: () => unwrap(api.debts.$get()) });
}

export function useEvents() {
  return useQuery({ queryKey: ["events"], queryFn: () => unwrap(api.events.$get()) });
}

export function useInsights(from: number, to: number) {
  return useQuery({
    queryKey: ["insights", from, to],
    queryFn: () =>
      unwrap(api.insights.summary.$get({ query: { from: String(from), to: String(to) } })),
  });
}

const fetchAccounts = () => unwrap(api.accounts.$get({ query: {} }));
const fetchCategories = () => unwrap(api.categories.$get());

export type Transaction = NonNullable<ReturnType<typeof useTransaction>["data"]>;
export type Account = Awaited<ReturnType<typeof fetchAccounts>>[number];
export type Category = Awaited<ReturnType<typeof fetchCategories>>[number];
export type Budgets = NonNullable<ReturnType<typeof useBudgets>["data"]>;
export type BudgetLine = Budgets["lines"][number];
export type Recurring = NonNullable<ReturnType<typeof useRecurring>["data"]>[number];
export type Goal = NonNullable<ReturnType<typeof useGoals>["data"]>[number];
export type Debt = NonNullable<ReturnType<typeof useDebts>["data"]>[number];
export type MoneyEvent = NonNullable<ReturnType<typeof useEvents>["data"]>[number];

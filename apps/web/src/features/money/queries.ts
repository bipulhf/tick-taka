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

export function useRecurring() {
  return useQuery({ queryKey: ["recurring"], queryFn: () => unwrap(api.recurring.$get()) });
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

export function useShopping(list?: string) {
  return useQuery({
    queryKey: ["shopping", list ?? "all"],
    queryFn: () => unwrap(api.shopping.$get({ query: list ? { list } : {} })),
  });
}

export function useShoppingLists() {
  return useQuery({
    queryKey: ["shopping-lists"],
    queryFn: () => unwrap(api.shopping.lists.$get()),
  });
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
export type ShoppingItem = NonNullable<ReturnType<typeof useShopping>["data"]>[number];

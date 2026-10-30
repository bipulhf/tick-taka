import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import {
  type TransactionFilters,
  validateTransactionSearch,
} from "@/features/money/transaction-filters";
import { TransactionsView } from "@/features/money/transactions-view";

export const Route = createFileRoute("/_auth/_shell/money/transactions")({
  validateSearch: validateTransactionSearch,
  component: TransactionsPage,
});

function TransactionsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const onFilters = useCallback(
    (patch: Partial<TransactionFilters>) =>
      void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true }),
    [navigate],
  );
  return <TransactionsView filters={search} onFilters={onFilters} />;
}

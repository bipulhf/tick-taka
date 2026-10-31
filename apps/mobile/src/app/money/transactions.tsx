import { useLocalSearchParams } from "expo-router";
import { TransactionList } from "@/features/money/transaction-list";

export default function TransactionsRoute() {
  const { accountId, eventId, view } = useLocalSearchParams<{
    accountId?: string;
    eventId?: string;
    view?: string;
  }>();
  return (
    <TransactionList
      accountId={accountId}
      eventId={eventId}
      view={view === "month" ? "month" : "list"}
    />
  );
}

import { useLocalSearchParams } from "expo-router";
import { TransactionList } from "@/features/money/transaction-list";

export default function TransactionsRoute() {
  const { accountId, eventId } = useLocalSearchParams<{ accountId?: string; eventId?: string }>();
  return <TransactionList accountId={accountId} eventId={eventId} />;
}

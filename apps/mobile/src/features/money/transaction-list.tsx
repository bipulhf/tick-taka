import {
  endOfLocalDay,
  localMonthRange,
  startOfLocalDay,
  toLocalDate,
} from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PickerField } from "@/components/ui/picker-field";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { useThisMonth } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { SpendingMonth } from "./money-calendar";
import { type Transaction, useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

type TypeFilter = "expense" | "income" | "transfer" | undefined;
type Layout = "list" | "month";

const LAYOUTS: { value: Layout; label: string }[] = [
  { value: "list", label: "List" },
  { value: "month", label: "Month" },
];

/**
 * Every transaction, newest first, with search and filters; pages load as I scroll.
 * "Month" puts a grid of daily spending on top; tapping a day shows only that day.
 */
export function TransactionList({
  accountId,
  eventId,
  view = "list",
}: {
  accountId?: string;
  eventId?: string;
  view?: Layout;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const lookup = useLookup(accounts, categories);
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>(undefined);
  const [account, setAccount] = useState<string | undefined>(accountId);
  const [layout, setLayout] = useState<Layout>(view);
  const thisMonth = useThisMonth();
  const [month, setMonth] = useState(thisMonth);
  const [day, setDay] = useState<string | undefined>(undefined);
  const timeZone = userTime(settings).timeZone;
  // The month view lists the picked day, or the whole month on show.
  const range =
    layout === "month"
      ? day
        ? { from: startOfLocalDay(day, timeZone), to: endOfLocalDay(day, timeZone) }
        : localMonthRange(month, timeZone)
      : null;
  const query = useTransactions({
    ...(q ? { q } : {}),
    ...(type ? { type } : {}),
    ...(account ? { accountId: account } : {}),
    ...(eventId ? { eventId } : {}),
    ...(range ? { from: String(range.from), to: String(range.to) } : {}),
  });
  const filtered = Boolean(q || type || account || eventId || range);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const sections: { title: string; data: Transaction[] }[] = [];
  for (const tx of items) {
    const day = toLocalDate(tx.occurredAt, timeZone);
    const last = sections.at(-1);
    if (last?.title === day) last.data.push(tx);
    else sections.push({ title: day, data: [tx] });
  }
  return (
    <SectionList
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
      }}
      sections={sections}
      keyExtractor={(tx) => tx.id}
      stickySectionHeadersEnabled={false}
      onEndReached={() =>
        query.hasNextPage && !query.isFetchingNextPage && void query.fetchNextPage()
      }
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View className="gap-3 pb-2">
          <View className="flex-row items-center justify-between">
            <Text variant="title">Transactions</Text>
            <Button
              label="New"
              size="sm"
              icon="plus"
              onPress={() => router.push("/transaction/new")}
            />
          </View>
          <Segmented
            label="Show"
            kind="tabs"
            options={LAYOUTS}
            value={layout}
            onChange={setLayout}
          />
          <TextField value={q} onChangeText={setQ} placeholder="Search notes" />
          <View className="flex-row gap-2">
            <PickerField
              label="Type"
              variant="filter"
              span="half"
              value={type ?? null}
              noneLabel="All"
              options={[
                { id: "expense", label: "Expense" },
                { id: "income", label: "Income" },
                { id: "transfer", label: "Transfer" },
              ]}
              onChange={(t) => setType((t ?? undefined) as TypeFilter)}
            />
            <PickerField
              label="Account"
              variant="filter"
              span="half"
              value={account ?? null}
              noneLabel="All"
              options={accounts.map((a) => ({ id: a.id, label: a.name }))}
              onChange={(id) => setAccount(id ?? undefined)}
            />
          </View>
          {layout === "month" ? (
            <SpendingMonth
              month={month}
              onMonth={(next) => {
                setMonth(next);
                setDay(undefined);
              }}
              selected={day}
              onSelect={setDay}
            />
          ) : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text variant="label" tone="muted" className="pt-4">
          {formatLocalDate(section.title, "long")}
        </Text>
      )}
      renderItem={({ item }) => (
        <View className="bg-background">
          <TransactionRow tx={item} lookup={lookup} perspectiveAccountId={account} />
        </View>
      )}
      ListEmptyComponent={
        query.data === undefined ? (
          query.isError ? (
            <ErrorState onRetry={() => void query.refetch()} />
          ) : (
            <SkeletonList rows={6} trailing />
          )
        ) : range && day && !(q || type || account || eventId) ? (
          <EmptyState
            title="Nothing logged this day"
            message="A quiet day for your wallet. Tap another day to see where money moved."
            mood="relaxed"
          />
        ) : (
          <EmptyState
            title={filtered ? "No matches" : "No transactions yet"}
            message={
              filtered
                ? "No transactions match. Try another search or clear a filter."
                : "Log one in seconds and your history starts here."
            }
            actionLabel="Add one"
            onAction={() => router.push("/transaction/new")}
          />
        )
      }
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator className="py-4" /> : null}
    />
  );
}

import { toLocalDate } from "@tick-taka/shared/dates";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, SectionList, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PickerField } from "@/components/ui/picker-field";
import { SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatLocalDate } from "@/lib/format";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import { type Transaction, useTransactions } from "./queries";
import { TransactionRow, useLookup } from "./transaction-row";

type TypeFilter = "expense" | "income" | "transfer" | undefined;

/** Every transaction, newest first, with search and filters; pages load as I scroll. */
export function TransactionList({ accountId, eventId }: { accountId?: string; eventId?: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const lookup = useLookup(accounts, categories);
  const [q, setQ] = useState("");
  const [type, setType] = useState<TypeFilter>(undefined);
  const [account, setAccount] = useState<string | undefined>(accountId);
  const query = useTransactions({
    ...(q ? { q } : {}),
    ...(type ? { type } : {}),
    ...(account ? { accountId: account } : {}),
    ...(eventId ? { eventId } : {}),
  });
  const filtered = Boolean(q || type || account || eventId);
  const timeZone = userTime(settings).timeZone;
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

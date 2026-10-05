import { describeRRule } from "@tick-taka/shared/recurrence";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListRow } from "@/components/ui/list-row";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { useRecurring } from "@/features/plan/queries";
import { formatLocalDate } from "@/lib/format";
import { useRemove } from "@/lib/use-remove";

const STATUS = {
  overdue: "Overdue",
  due_today: "Due today",
  due_soon: "Due soon",
  upcoming: "",
} as const;

/** Bills and subscriptions, plus salaries and other expected income. */
export function BillsScreen() {
  const router = useRouter();
  const recurring = useRecurring();
  const remove = useRemove();
  const list = recurring.data ?? [];
  const groups = [
    { title: "Bills and subscriptions", items: list.filter((r) => r.kind === "bill") },
    { title: "Expected income", items: list.filter((r) => r.kind === "income") },
  ];
  return (
    <Screen
      title="Bills & income"
      tabBarPadding={false}
      right={
        <Button
          label="New"
          size="sm"
          icon="plus"
          onPress={() => router.push("/money/recurring/new")}
        />
      }
    >
      <AsyncContent
        query={recurring}
        skeleton={<SkeletonList rows={4} leading="none" trailing />}
        isEmpty={() => list.length === 0}
        empty={
          <EmptyState
            title="No bills yet"
            message="Add rent, internet or your salary so nothing sneaks up."
            actionLabel="Add a bill"
            onAction={() => router.push("/money/recurring/new")}
          />
        }
      >
        {() =>
          groups.map((group) =>
            group.items.length ? (
              <Section key={group.title} title={group.title}>
                <Group>
                  {group.items.map((item) => {
                    const edit = () => router.push(`/money/recurring/${item.id}`);
                    return (
                      <SwipeRow
                        key={item.id}
                        rounded={false}
                        actions={editDelete(edit, () =>
                          remove(`/recurring/${item.id}`, `“${item.name}”`),
                        )}
                      >
                        <View className="bg-card">
                          <ListRow
                            title={item.name}
                            subtitle={[
                              STATUS[item.status],
                              formatLocalDate(item.dueDate),
                              describeRRule(item.rrule),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                            onPress={edit}
                            right={
                              <Amount
                                minor={item.amountMinor}
                                currency={item.currency}
                                variant="strong"
                                tone={
                                  item.kind === "income"
                                    ? "mint"
                                    : item.status === "overdue"
                                      ? "coral"
                                      : "ink"
                                }
                              />
                            }
                          />
                        </View>
                      </SwipeRow>
                    );
                  })}
                </Group>
              </Section>
            ) : null,
          )
        }
      </AsyncContent>
    </Screen>
  );
}

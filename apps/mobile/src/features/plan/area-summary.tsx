import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatMinutes } from "@/lib/format";
import { useAreaSummaries } from "./queries";

/**
 * The area page's summary under its title: hours this week, money spent (and earned,
 * when there is some) this month, open tasks. Amounts hide with Hide amounts.
 */
export function AreaSummary({ areaId }: { areaId: string }) {
  const summaries = useAreaSummaries();
  if (!summaries.data)
    return summaries.isError ? null : <Skeleton className="h-5 w-64 rounded-lg" />;
  const row = summaries.data.find((r) => r.area.id === areaId);
  if (!row) return null;
  return (
    <View className="flex-row flex-wrap gap-x-4 gap-y-1">
      <Text variant="callout" tone="muted">
        <Text variant="callout" tone="sky" className="font-nunito-bold" numeric>
          {formatMinutes(row.weekMinutes)}
        </Text>{" "}
        this week
      </Text>
      <Text variant="callout" tone="muted">
        <Amount
          minor={row.monthSpentMinor}
          variant="callout"
          tone="coral"
          className="font-nunito-bold"
          animate={false}
        />{" "}
        spent this month
      </Text>
      {row.monthIncomeMinor > 0 ? (
        <Text variant="callout" tone="muted">
          <Amount
            minor={row.monthIncomeMinor}
            variant="callout"
            tone="mint"
            className="font-nunito-bold"
            animate={false}
          />{" "}
          earned
        </Text>
      ) : null}
      <Text variant="callout" tone="muted">
        <Text variant="callout" className="font-nunito-bold" numeric>
          {row.openTasks}
        </Text>{" "}
        {row.openTasks === 1 ? "open task" : "open tasks"}
      </Text>
    </View>
  );
}

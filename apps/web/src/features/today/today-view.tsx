import { currentWeeklyFocus } from "@tick-taka/shared/weekly-review";
import type { TikiOutfit } from "@/components/tiki/tiki";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { useIsDesk } from "@/components/ui/use-media";
import { HabitChips } from "@/features/habits/habit-chips";
import { formatLocalDate } from "@/lib/format";
import { type TodayData, useAreas, useSettings } from "@/lib/queries";
import { useToday, useTodayDate } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { LaterToday } from "./later-today";
import { MoneyDue } from "./money-due";
import { NextUp } from "./next-up";
import { QuickActions } from "./quick-actions";
import { SafeToSpendCard } from "./safe-to-spend-card";
import { TodayHeader } from "./today-header";
import { TopThree } from "./top-three";

/** Today's layout in outline while the first load runs. */
function TodaySkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-7">
      <div className="flex items-center gap-4">
        <Skeleton className="size-[60px] rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <div className="grid gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <SkeletonRows rows={3} />
          <Skeleton className="mt-4 h-5 w-24" />
          <SkeletonRows rows={3} />
        </div>
        <Skeleton className="h-48 rounded-3xl" />
      </div>
    </div>
  );
}

/**
 * Today answers two questions first: what now, and can I afford it. On a desk the
 * time half (left) and the money and habits half (right) sit side by side; below
 * that they stack in the phone's order.
 */
export function TodayView() {
  const today = useToday();
  const localToday = useTodayDate();
  const desk = useIsDesk();
  const { data: areas } = useAreas();
  const { data: settings } = useSettings();
  const data = today.data;

  if (!data)
    return today.isError ? <ErrorState onRetry={() => void today.refetch()} /> : <TodaySkeleton />;

  const areaEmoji = (areaId: string | null) => areas?.find((a) => a.id === areaId)?.emoji;
  const header = (
    <>
      <TodayHeader
        data={data}
        outfit={(settings?.tikiOutfit ?? null) as TikiOutfit}
        timeZone={userTime(settings).timeZone}
        focus={settings ? currentWeeklyFocus(settings, data.date) : null}
      />
      {data.date < localToday ? (
        // Past midnight with yesterday's numbers on screen: say so until today's load.
        <p role="alert" className="-mt-4 text-caption text-muted">
          {`Showing ${formatLocalDate(data.date, "long")} · today's numbers load once you're back online`}
        </p>
      ) : null}
    </>
  );

  return (
    <div className="flex flex-col gap-7">
      {header}
      {desk ? (
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-8">
          <div className="flex flex-col gap-7">
            <div data-tour="top-three">
              <TopThree data={data} />
            </div>
            <NextUp data={data} areaEmoji={areaEmoji} />
            <LaterToday data={data} />
          </div>
          <div className="flex flex-col gap-7">
            <div data-tour="safe-to-spend">
              <SafeToSpendCard data={data} />
            </div>
            <MoneyDue data={data} />
            <HabitChips data={data} />
            <QuickActions />
          </div>
        </div>
      ) : (
        <PhoneOrder data={data} areaEmoji={areaEmoji} />
      )}
    </div>
  );
}

/** One column: the phone's order, shortcuts last because they repeat quick-add. */
function PhoneOrder({
  data,
  areaEmoji,
}: {
  data: TodayData;
  areaEmoji: (areaId: string | null) => string | undefined;
}) {
  return (
    <>
      <div data-tour="safe-to-spend">
        <SafeToSpendCard data={data} />
      </div>
      <div data-tour="top-three">
        <TopThree data={data} />
      </div>
      <NextUp data={data} areaEmoji={areaEmoji} />
      <MoneyDue data={data} />
      <HabitChips data={data} />
      <LaterToday data={data} />
      <QuickActions />
    </>
  );
}

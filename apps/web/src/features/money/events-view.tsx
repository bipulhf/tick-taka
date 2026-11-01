import { Plus } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardGrid, ItemCardSkeletons } from "@/components/ui/item-card";
import { ListSection } from "@/components/ui/list-section";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatLocalDate, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useTodayDate } from "@/lib/use-today";
import { EventCard } from "./event-card";
import { eventTotals, groupEvents } from "./event-groups";
import { useEvents } from "./queries";

/**
 * Trips and celebrations, each with its own budget, collecting spending from every
 * account: what's on now and next and this year's spending, then the events grouped
 * Active, Upcoming and Past.
 */
export function EventsView() {
  const open = useOpenPanel();
  const events = useEvents();
  const today = useTodayDate();
  const create = () => open("event:new");
  const list = events.data ?? [];
  const totals = eventTotals(list, today);
  const loading = !events.data;
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Events"
        primary={{ label: "New event", icon: Plus, onClick: create }}
        summary={
          events.data?.length === 0 ? undefined : (
            <SummaryStrip label="Events">
              <StatTile
                label="Active now"
                tone="time"
                value={totals.active}
                caption={totals.active ? "Spending counts toward them" : "Nothing on right now"}
                loading={loading}
              />
              <StatTile
                label="Upcoming"
                tone="time"
                value={totals.upcoming}
                caption={
                  totals.next
                    ? `Next: ${totals.next.name}, ${formatLocalDate(totals.next.startsOn)}`
                    : "Nothing planned yet"
                }
                loading={loading}
              />
              <StatTile
                label="Spent this year"
                tone="out"
                minor={totals.spentThisYearMinor}
                caption={`Across ${plural(totals.eventsThisYear, "event")} in ${today.slice(0, 4)}`}
                loading={loading}
              />
            </SummaryStrip>
          )
        }
      />
      {events.data === undefined ? (
        events.isError ? (
          <ErrorState onRetry={() => void events.refetch()} />
        ) : (
          <ItemCardSkeletons />
        )
      ) : list.length === 0 ? (
        <EmptyState
          title="No events yet"
          message="Group a trip's spending from cash, bKash and card in one place."
          actionLabel="Create an event"
          onAction={create}
        />
      ) : (
        groupEvents(list, today).map((group) => (
          <ListSection
            key={group.key}
            id={`events-${group.key}`}
            variant="heading"
            align="edge"
            title={group.title}
            total={(() => {
              const spent = group.items.reduce((sum, e) => sum + e.spentMinor, 0);
              return spent ? <Amount minor={-spent} animate={false} /> : undefined;
            })()}
          >
            <CardGrid label={`${group.title} events`}>
              {group.items.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </CardGrid>
          </ListSection>
        ))
      )}
    </div>
  );
}

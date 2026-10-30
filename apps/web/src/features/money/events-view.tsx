import { useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, RowMark } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDate, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useRowKeyActions } from "@/lib/row-keys";
import { remove } from "@/lib/write";
import { RowMenu } from "./money-ui";
import { type MoneyEvent, useEvents } from "./queries";

function EventItem({ event }: { event: MoneyEvent }) {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const edit = () => open(`event:${event.id}`);
  const drop = () => void remove(`/events/${event.id}`, `“${event.name}”`).catch(() => {});
  useRowKeyActions(`event:${event.id}`, { remove: drop });
  const over = event.leftMinor !== null && event.leftMinor < 0;
  return (
    <div
      data-row={`event:${event.id}`}
      className="group/row relative flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-line/30"
    >
      <div className="flex items-center gap-3">
        <RowMark emoji={event.emoji} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            data-row-primary
            onClick={() =>
              void navigate({
                to: "/money/transactions",
                search: { eventId: event.id },
              })
            }
            className="block w-full truncate text-left text-body font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none after:focus-visible:rounded-2xl after:focus-visible:ring-2 after:focus-visible:ring-sky-text after:focus-visible:ring-inset"
          >
            {event.name}
          </button>
          <p className="truncate text-callout text-muted">
            {formatLocalDate(event.startsOn)} – {formatLocalDate(event.endsOn)} ·{" "}
            {plural(event.transactionCount, "transaction")}
          </p>
        </div>
        <Amount
          minor={event.spentMinor ? -event.spentMinor : 0}
          tone={event.spentMinor ? "out" : undefined}
          className="font-bold"
        />
        <div className="relative z-10">
          <RowMenu
            label={`More for ${event.name}`}
            items={[
              { label: "Edit", icon: Pencil, onSelect: edit },
              { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
            ]}
          />
        </div>
      </div>
      {event.budgetMinor ? (
        <div className="flex flex-col gap-1.5 sm:pl-12">
          <ProgressBar
            value={event.spentMinor / event.budgetMinor}
            tone={over ? "coral" : "mint"}
            label={`${event.name} budget used`}
          />
          <p className="text-caption text-muted">
            <Amount minor={event.leftMinor ?? 0} animate={false} className="text-ink" /> left of{" "}
            <Amount minor={event.budgetMinor} animate={false} />
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** A trip or celebration with its own budget, collecting spending from every account. */
export function EventsView() {
  const open = useOpenPanel();
  const events = useEvents();
  const create = () => open("event:new");
  return (
    <div className="flex max-w-3xl flex-col gap-7">
      <PageHeader
        title="Events"
        back={{ to: "/money", label: "Money" }}
        actions={
          <Button size="sm" icon={Plus} onClick={create}>
            New
          </Button>
        }
      />
      {events.data === undefined ? (
        events.isError ? (
          <ErrorState onRetry={() => void events.refetch()} />
        ) : (
          <SkeletonRows rows={3} />
        )
      ) : events.data.length === 0 ? (
        <EmptyState
          title="No events yet"
          message="Group a trip's spending from cash, bKash and card in one place."
          actionLabel="Create an event"
          onAction={create}
        />
      ) : (
        <Group label="Events">
          {events.data.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </Group>
      )}
    </div>
  );
}

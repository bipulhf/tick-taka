import { useNavigate } from "@tanstack/react-router";
import { Pencil, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { cx } from "@/components/ui/cx";
import { RowMark } from "@/components/ui/group";
import { ItemCard } from "@/components/ui/item-card";
import { ProgressBar } from "@/components/ui/progress";
import { formatLocalDate, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useTodayDate } from "@/lib/use-today";
import { remove } from "@/lib/write";
import { eventDays, eventPace, eventPhase } from "./event-groups";
import { RowMenu } from "./money-ui";
import type { MoneyEvent } from "./queries";

/** "3 days left", "Starts tomorrow", "Ended Sun 20 Sep": when the event is, in a few words. */
function timing(event: MoneyEvent, today: string): string {
  const days = eventDays(event, today);
  switch (eventPhase(event, today)) {
    case "active":
      return days === 0 ? "Last day" : `${plural(days, "day")} left`;
    case "upcoming":
      return days === 1 ? "Starts tomorrow" : `In ${plural(days, "day")}`;
    default:
      return `Ended ${formatLocalDate(event.endsOn)}`;
  }
}

/**
 * One trip or celebration: its dates and when it is, what it spent of its budget with
 * a bar (and, while it's on, a mark for how far through it today is). The card opens
 * the event's transactions; Edit is in its menu.
 */
export function EventCard({ event }: { event: MoneyEvent }) {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const today = useTodayDate();
  const edit = () => open(`event:${event.id}`);
  const drop = () => void remove(`/events/${event.id}`, `“${event.name}”`).catch(() => {});
  const phase = eventPhase(event, today);
  const over = event.leftMinor !== null && event.leftMinor < 0;
  const dates =
    event.startsOn === event.endsOn
      ? formatLocalDate(event.startsOn)
      : `${formatLocalDate(event.startsOn)} – ${formatLocalDate(event.endsOn)}`;
  return (
    <ItemCard
      dataKey={`event:${event.id}`}
      keyActions={{ remove: drop }}
      onOpen={() => void navigate({ to: "/money/transactions", search: { eventId: event.id } })}
      leading={<RowMark emoji={event.emoji} />}
      title={event.name}
      subtitle={dates}
      menu={
        <RowMenu
          label={`More for ${event.name}`}
          items={[
            { label: "Edit", icon: Pencil, onSelect: edit },
            { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
          ]}
        />
      }
    >
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-callout text-muted">
          <span>
            <Amount minor={event.spentMinor} animate={false} className="text-heading text-ink" />{" "}
            {event.budgetMinor ? (
              <>
                of <Amount minor={event.budgetMinor} animate={false} />
              </>
            ) : (
              "spent"
            )}
          </span>
          <span
            className={cx(
              "font-bold whitespace-nowrap",
              phase === "past" ? "text-muted" : "text-sky-text",
            )}
          >
            {timing(event, today)}
          </span>
        </p>
        {event.budgetMinor ? (
          <ProgressBar
            value={event.spentMinor / event.budgetMinor}
            tone={over ? "coral" : "mint"}
            label={`${event.name} budget used`}
            marker={phase === "active" ? eventPace(event, today) : undefined}
          />
        ) : null}
        <p className="truncate text-caption font-normal text-muted">
          {event.budgetMinor && event.leftMinor !== null ? (
            over ? (
              <span className="text-coral-text">
                Over by <Amount minor={-event.leftMinor} animate={false} />
              </span>
            ) : (
              <>
                <Amount minor={event.leftMinor} animate={false} /> left
              </>
            )
          ) : (
            "No budget"
          )}
          {` · ${plural(event.transactionCount, "transaction")}`}
        </p>
      </div>
    </ItemCard>
  );
}

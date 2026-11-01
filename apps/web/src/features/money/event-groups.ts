import { diffDays } from "@tick-taka/shared/dates";

/** Pure rules behind the events view. */

interface EventLike {
  startsOn: string;
  endsOn: string;
  spentMinor: number;
}

export type EventPhase = "active" | "upcoming" | "past";

export function eventPhase(event: EventLike, today: string): EventPhase {
  if (event.endsOn < today) return "past";
  if (event.startsOn > today) return "upcoming";
  return "active";
}

const TITLES: Record<EventPhase, string> = {
  active: "Active",
  upcoming: "Upcoming",
  past: "Past",
};

/**
 * Events grouped Active (ending soonest first), Upcoming (starting soonest first) and
 * Past (the latest first); empty groups are left out.
 */
export function groupEvents<T extends EventLike>(
  events: T[],
  today: string,
): { key: EventPhase; title: string; items: T[] }[] {
  const of = (key: EventPhase) => events.filter((e) => eventPhase(e, today) === key);
  const groups: { key: EventPhase; items: T[] }[] = [
    { key: "active", items: of("active").sort((a, b) => a.endsOn.localeCompare(b.endsOn)) },
    { key: "upcoming", items: of("upcoming").sort((a, b) => a.startsOn.localeCompare(b.startsOn)) },
    { key: "past", items: of("past").sort((a, b) => b.endsOn.localeCompare(a.endsOn)) },
  ];
  return groups.filter((g) => g.items.length > 0).map((g) => ({ ...g, title: TITLES[g.key] }));
}

/**
 * When an event is, in days: an active one's days left after today (0 on its last
 * day), an upcoming one's days until it starts, a past one's days since it ended.
 */
export function eventDays(event: EventLike, today: string): number {
  switch (eventPhase(event, today)) {
    case "active":
      return diffDays(today, event.endsOn);
    case "upcoming":
      return diffDays(today, event.startsOn);
    default:
      return diffDays(event.endsOn, today);
  }
}

/** How far through an active event today is, 0 to 1 (today counted as passed). */
export function eventPace(event: EventLike, today: string): number {
  const total = diffDays(event.startsOn, event.endsOn) + 1;
  return Math.min(1, Math.max(0, (diffDays(event.startsOn, today) + 1) / total));
}

/** The strip: how many are on now and coming up, and what this year's events spent. */
export function eventTotals<T extends EventLike>(events: T[], today: string) {
  const year = today.slice(0, 4);
  const thisYear = events.filter((e) => e.startsOn.slice(0, 4) === year);
  const upcoming = events
    .filter((e) => eventPhase(e, today) === "upcoming")
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  return {
    active: events.filter((e) => eventPhase(e, today) === "active").length,
    upcoming: upcoming.length,
    next: upcoming[0] ?? null,
    spentThisYearMinor: thisYear.reduce((sum, e) => sum + e.spentMinor, 0),
    eventsThisYear: thisYear.length,
  };
}

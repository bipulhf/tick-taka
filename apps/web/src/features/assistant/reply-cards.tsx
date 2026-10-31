import { useNavigate } from "@tanstack/react-router";
import type { AssistantCard, AssistantRecordKind } from "@tick-taka/shared/schemas/ai";
import {
  Banknote,
  CalendarDays,
  ChevronRight,
  CircleCheckBig,
  FolderKanban,
  Handshake,
  ListChecks,
  type LucideIcon,
  Receipt,
  Repeat,
  ShoppingCart,
  Target,
  Timer,
  Wallet,
} from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { cx } from "@/components/ui/cx";
import { useIsDesk } from "@/components/ui/use-media";
import { formatMinutes } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { assistantOpenStore } from "@/lib/ui-state";
import { recordTarget } from "./screen";

type RecordCard = Extract<AssistantCard, { type: "record" }>;
type TotalCard = Extract<AssistantCard, { type: "total" }>;

const KIND: Record<AssistantRecordKind, { icon: LucideIcon; noun: string }> = {
  task: { icon: CircleCheckBig, noun: "task" },
  transaction: { icon: Banknote, noun: "transaction" },
  habit: { icon: Repeat, noun: "habit" },
  goal: { icon: Target, noun: "goal" },
  debt: { icon: Handshake, noun: "debt" },
  account: { icon: Wallet, noun: "account" },
  event: { icon: CalendarDays, noun: "event" },
  project: { icon: FolderKanban, noun: "project" },
  recurring: { icon: Receipt, noun: "bill" },
  shopping_item: { icon: ShoppingCart, noun: "shopping item" },
  time_entry: { icon: Timer, noun: "time entry" },
  routine: { icon: ListChecks, noun: "routine" },
};

/** A record Tiki made, changed or named: a small row that opens it. */
function RecordRows({ cards }: { cards: RecordCard[] }) {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const desk = useIsDesk();
  const show = (card: RecordCard) => {
    // On a phone the chat covers the page; step aside so the record can be seen.
    if (!desk) assistantOpenStore.set(false);
    const target = recordTarget(card.kind, card.id);
    if ("panel" in target) open(target.panel);
    else void navigate({ to: "/plan/routine/$id", params: { id: target.routineId } });
  };
  return (
    <ul
      aria-label="In this reply"
      className="w-full overflow-hidden rounded-2xl border border-line"
    >
      {cards.map((card, index) => {
        const { icon: Icon, noun } = KIND[card.kind];
        return (
          <li key={`${card.kind}-${card.id}`} className={cx(index > 0 && "border-t border-line")}>
            <button
              type="button"
              onClick={() => show(card)}
              aria-label={`Open ${noun} “${card.title}”`}
              className="flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-line/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-text focus-visible:ring-inset"
            >
              <Icon aria-hidden className="size-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-callout font-semibold">{card.title}</span>
                {card.subtitle ? (
                  <span className="block truncate text-caption font-normal text-muted">
                    {card.subtitle}
                  </span>
                ) : null}
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** A report's number: money as an amount, time in hours and minutes, or a count. */
function TotalValue({ card }: { card: TotalCard }) {
  if (card.amountMinor !== undefined)
    return <Amount minor={card.amountMinor} animate={false} className="text-heading" />;
  if (card.minutes !== undefined)
    return <span className="text-heading tabular">{formatMinutes(card.minutes)}</span>;
  return <span className="text-heading tabular">{(card.count ?? 0).toLocaleString("en-US")}</span>;
}

function Totals({ cards }: { cards: TotalCard[] }) {
  return (
    <ul className="flex w-full flex-wrap gap-2">
      {cards.map((card, index) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: a reply's totals never reorder, and two can share a label.
          key={`${card.label}-${index}`}
          className="flex min-w-32 flex-1 flex-col gap-0.5 rounded-2xl bg-card px-4 py-2.5"
        >
          <span className="text-caption text-muted">{card.label}</span>
          <TotalValue card={card} />
        </li>
      ))}
    </ul>
  );
}

/** What Tiki's reply points at: totals to glance at, then records to open. */
export function ReplyCards({ cards }: { cards: AssistantCard[] }) {
  const totals = cards.filter((card): card is TotalCard => card.type === "total");
  const records = cards.filter((card): card is RecordCard => card.type === "record");
  return (
    <>
      {totals.length ? <Totals cards={totals} /> : null}
      {records.length ? <RecordRows cards={records} /> : null}
    </>
  );
}

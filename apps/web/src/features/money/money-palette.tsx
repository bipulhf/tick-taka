import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { addMonths } from "@tick-taka/shared/dates";
import { Command } from "cmdk";
import { CalendarPlus, HandCoins } from "lucide-react";
import { useEffect, useState } from "react";
import {
  paletteItemClass,
  registerPaletteActions,
  registerPaletteSearch,
} from "@/components/shell/command-palette";
import { Amount } from "@/components/ui/amount";
import { api, unwrap } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useThisMonth, useUserTime } from "@/lib/use-today";
import { transactionAmount } from "./transaction-amount";
import { transactionTitle, useLookup } from "./transaction-row";

const groupClass =
  "px-1 py-1 text-caption text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5";

/** Waits for typing to settle before searching. */
function useSettled(value: string, ms = 250) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

function TransactionHits({ query, close }: { query: string; close: () => void }) {
  const q = useSettled(query);
  const open = useOpenPanel();
  const lookup = useLookup();
  const { timeZone } = useUserTime();
  const hits = useQuery({
    queryKey: ["transactions", "palette", q],
    queryFn: () => unwrap(api.transactions.$get({ query: { q, limit: "6" } })),
    staleTime: 30_000,
  });
  const items = hits.data?.items ?? [];
  if (items.length === 0) return null;
  return (
    <Command.Group heading="Transactions" className={groupClass}>
      {items.map((tx) => {
        const title = transactionTitle(tx, lookup);
        const amount = transactionAmount(tx);
        return (
          <Command.Item
            key={tx.id}
            // The server already matched it; the typed words keep it past cmdk's own filter.
            value={`transaction ${tx.id} ${query}`}
            onSelect={() => {
              close();
              open(`transaction:${tx.id}`);
            }}
            className={paletteItemClass}
          >
            <span aria-hidden className="w-5 text-center">
              {tx.type === "transfer"
                ? "🔁"
                : tx.type === "adjustment"
                  ? "⚖️"
                  : (lookup.category(tx.categoryId)?.emoji ?? "💸")}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</span>
            <span className="text-caption font-normal text-muted">
              {formatWhen(tx.occurredAt, false, Date.now(), timeZone)}
            </span>
            <Amount
              minor={amount.minor}
              currency={lookup.account(tx.accountId)?.currency}
              signed={amount.signed}
              tone={amount.tone === "mint" ? "in" : amount.tone === "coral" ? "out" : undefined}
              animate={false}
              className="text-callout font-bold"
            />
          </Command.Item>
        );
      })}
    </Command.Group>
  );
}

const icon = "size-4 text-muted";

/**
 * Adds transaction search to the command palette (GET /transactions?q=…): a hit opens
 * its panel over whichever view is open. Also Budgets' two steps, so "payday" or
 * "salary" still finds them. Mount once inside the signed-in shell.
 */
export function MoneyPalette() {
  const navigate = useNavigate();
  const next = addMonths(useThisMonth(), 1);
  useEffect(
    () =>
      registerPaletteActions(() => [
        {
          id: "split-my-pay",
          label: "Split my pay",
          group: "Actions",
          icon: <HandCoins aria-hidden className={icon} />,
          keywords: ["payday", "salary", "budget", "plan"],
          run: () => void navigate({ to: "/money/budgets", search: { split: true } }),
        },
        {
          id: "plan-next-month",
          label: "Plan next month",
          group: "Actions",
          icon: <CalendarPlus aria-hidden className={icon} />,
          keywords: ["budget", "payday", "salary"],
          run: () => void navigate({ to: "/money/budgets", search: { plan: next } }),
        },
      ]),
    [navigate, next],
  );
  useEffect(
    () =>
      registerPaletteSearch((query, close) => (
        <TransactionHits key="transactions" query={query} close={close} />
      )),
    [],
  );
  return null;
}

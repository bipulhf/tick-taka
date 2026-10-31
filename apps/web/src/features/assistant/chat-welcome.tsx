import { localParts } from "@tick-taka/shared/dates";
import { briefingFor } from "@tick-taka/shared/tiki-briefing";
import { suggestionsFor } from "@tick-taka/shared/tiki-suggestions";
import { Chip } from "@/components/ui/chip";
import { useAccounts, useSettings } from "@/lib/queries";
import { useToday, useTodayDate, useUserTime } from "@/lib/use-today";
import { briefingInput, suggestionInput } from "./moment";

/**
 * The top of a new chat: a short briefing from Today's numbers (no AI call) and a
 * few prompts that fit the page and the hour. Before Today has loaded, just the prompts.
 */
export function ChatWelcome({ view, onAsk }: { view: string; onAsk: (text: string) => void }) {
  const today = useToday();
  const localToday = useTodayDate();
  const { timeZone } = useUserTime();
  const { data: settings } = useSettings();
  const { data: accounts } = useAccounts();
  const hour = localParts(Date.now(), timeZone).hour;
  // Yesterday's numbers (offline past midnight) would brief the wrong day.
  const data = today.data && today.data.date === localToday ? today.data : undefined;
  const briefing = data
    ? briefingFor(
        briefingInput(data, hour, {
          currency: settings?.defaultCurrency,
          numerals: settings?.numerals,
        }),
      )
    : null;
  const suggestions = suggestionsFor(
    suggestionInput(data, view, hour, accounts === undefined || accounts.length > 0),
  );
  return (
    <div className="flex flex-col gap-4 pt-2">
      {briefing ? (
        <section
          aria-label="Your day so far"
          className="flex flex-col gap-2 rounded-3xl bg-card px-4 py-3.5"
        >
          <p className="text-body font-bold">{briefing.greeting}</p>
          <ul className="flex flex-col gap-1">
            {briefing.lines.map((line) => (
              <li key={line} className="text-callout">
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-callout text-muted">
        Tell me what to add, change or delete, or ask about your day and money. Click the mic to
        talk.
      </p>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            onClick={() => onAsk(suggestion)}
            className="h-auto min-h-8 py-1 whitespace-normal text-left"
          >
            {suggestion}
          </Chip>
        ))}
      </div>
    </div>
  );
}

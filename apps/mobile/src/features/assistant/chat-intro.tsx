import { localParts } from "@tick-taka/shared/dates";
import { briefingFor } from "@tick-taka/shared/tiki-briefing";
import { suggestionsFor } from "@tick-taka/shared/tiki-suggestions";
import { View } from "react-native";
import { Chip } from "@/components/ui/chip";
import { Text } from "@/components/ui/text";
import { numeralsStore } from "@/lib/format";
import { useAccounts, useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { useToday } from "@/lib/use-today";
import { userTime } from "@/lib/user-time";
import { briefingInput, suggestionInput } from "./chat-intro-inputs";

/**
 * The top of a new chat: a short briefing from Today's numbers (no AI call) and a
 * few prompts that fit the screen it was opened from and the time of day.
 */
export function ChatIntro({ view, onAsk }: { view: string; onAsk: (text: string) => void }) {
  const { data: settings } = useSettings();
  const { data: accounts } = useAccounts();
  const { data: day } = useToday();
  const numerals = useStore(numeralsStore);
  const hour = localParts(Date.now(), userTime(settings).timeZone).hour;
  // Until the accounts have loaded once, don't offer to set them up.
  const hasAccounts = accounts === undefined || accounts.length > 0;
  const suggestions = suggestionsFor(suggestionInput(day, view, hour, hasAccounts));
  const briefing = day
    ? briefingFor({
        ...briefingInput(day, hour),
        currency: settings?.defaultCurrency,
        numerals,
      })
    : null;

  return (
    <View className="gap-4 pt-2">
      {briefing ? (
        <View className="gap-1.5 rounded-3xl bg-card px-5 py-4" accessible>
          <Text variant="heading" accessibilityRole="header">
            {briefing.greeting}
          </Text>
          {briefing.lines.map((line) => (
            <Text key={line} variant="callout">
              {line}
            </Text>
          ))}
        </View>
      ) : null}
      <Text tone="muted">
        Tell me what to add, change or delete, or ask about your day and money. Tap the mic to talk.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            label={suggestion}
            choice="action"
            onPress={() => onAsk(suggestion)}
          />
        ))}
      </View>
    </View>
  );
}

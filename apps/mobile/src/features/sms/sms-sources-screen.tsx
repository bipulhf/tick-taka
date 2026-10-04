import { hasSmsPermission, isSmsReaderAvailable, setAllowedSenders } from "@modules/sms-reader";
import { formatAmount } from "@tick-taka/shared/money";
import { buildTemplates, parseWithTemplates } from "@tick-taka/shared/sms";
import { useState } from "react";
import { Linking, PermissionsAndroid, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useUpdateSettings } from "@/features/settings/use-update-settings";
import { notify } from "@/lib/notify";
import { useAccounts, useSettings } from "@/lib/queries";
import { useSmsScan } from "./use-sms-capture";

/** Settings › SMS sources: which senders count, their account, and templates from real samples. */
export function SmsSourcesScreen() {
  const { data: settings } = useSettings();
  const { data: accounts = [] } = useAccounts();
  const update = useUpdateSettings();
  const scan = useSmsScan();
  const [granted, setGranted] = useState(hasSmsPermission());
  const [sender, setSender] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [samples, setSamples] = useState("");
  const sources = settings?.smsSources ?? [];
  const sampleList = samples
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const templates = buildTemplates(sampleList);
  const previews = sampleList.map((sample) => parseWithTemplates(sample, templates));

  const requestPermission = async () => {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
    ]);
    const ok = Object.values(result).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
    setGranted(ok);
    if (!ok) notify("SMS access is greyed out? See the tip below.");
  };

  const save = () => {
    if (!sender.trim() || !accountId || templates.length === 0) return;
    const next = [
      ...sources.filter((s) => s.sender.toLowerCase() !== sender.trim().toLowerCase()),
      { sender: sender.trim(), accountId, templates },
    ];
    update({ smsSources: next });
    setAllowedSenders(next.map((s) => s.sender));
    setSender("");
    setSamples("");
    notify(
      `Saved ${templates.length} template${templates.length === 1 ? "" : "s"} for ${sender.trim()}`,
    );
  };

  if (!isSmsReaderAvailable) {
    return (
      <Screen title="SMS sources" tabBarPadding={false}>
        <Text tone="muted">SMS capture needs the development build of the app (not Expo Go).</Text>
      </Screen>
    );
  }

  return (
    <Screen title="SMS sources" tabBarPadding={false}>
      {!granted ? (
        <Card className="gap-2">
          <Text variant="strong">Let Tick & Taka read bank and wallet SMS</Text>
          <Text tone="muted">
            Only senders you add here are read, and anything with “OTP”, “code” or “PIN” is skipped.
            Raw messages stay on this phone; nothing is saved until you tap Add.
          </Text>
          <Button
            label="Allow SMS access"
            icon="message-lock-outline"
            onPress={requestPermission}
          />
          <Text variant="caption" tone="muted">
            Greyed out? Open phone Settings › Apps › Tick & Taka, tap ⋮, choose “Allow restricted
            settings”, then grant SMS again.
          </Text>
          <Button
            label="Open app settings"
            variant="ghost"
            size="sm"
            onPress={() => void Linking.openSettings()}
          />
        </Card>
      ) : (
        <Button
          label="Scan now"
          icon="refresh"
          variant="secondary"
          onPress={() =>
            void scan().then((n) =>
              notify(n ? `${n} new card${n === 1 ? "" : "s"}` : "Nothing new"),
            )
          }
        />
      )}
      <Section title="Senders">
        {sources.map((source) => (
          <Card key={source.sender} className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text variant="strong">{source.sender}</Text>
              <Text variant="caption" tone="muted">
                → {accounts.find((a) => a.id === source.accountId)?.name ?? "Account"} ·{" "}
                {source.templates.length} template{source.templates.length === 1 ? "" : "s"}
              </Text>
            </View>
            <Button
              label="Remove"
              size="sm"
              variant="ghost"
              onPress={() => {
                const next = sources.filter((s) => s.sender !== source.sender);
                update({ smsSources: next });
                setAllowedSenders(next.map((s) => s.sender));
              }}
            />
          </Card>
        ))}
        {sources.length === 0 ? <Text tone="muted">No senders yet.</Text> : null}
      </Section>
      <Section title="Add a sender">
        <Card className="gap-3">
          <TextField
            label="Sender ID as it appears in Messages"
            value={sender}
            onChangeText={setSender}
            placeholder="bKash"
            autoCapitalize="none"
          />
          <View className="flex-row flex-wrap gap-2">
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                tone="mint"
                selected={accountId === a.id}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </View>
          <TextField
            label="Paste 2–3 real messages, separated by a blank line"
            value={samples}
            onChangeText={setSamples}
            multiline
            numberOfLines={8}
            className="min-h-40"
            textAlignVertical="top"
          />
          {sampleList.map((sample, i) => {
            const parsed = previews[i];
            return (
              <Text key={sample.slice(0, 40)} variant="caption" tone={parsed ? "mint" : "coral"}>
                {parsed
                  ? `✓ ${parsed.direction} ${formatAmount(parsed.amountMinor)}${parsed.feeMinor ? ` · fee ${formatAmount(parsed.feeMinor)}` : ""}${parsed.counterparty ? ` · ${parsed.counterparty}` : ""}`
                  : "✗ Couldn't read an amount and direction from this one"}
              </Text>
            );
          })}
          <Button
            label="Save sender"
            onPress={save}
            disabled={!sender.trim() || !accountId || templates.length === 0}
          />
        </Card>
      </Section>
    </Screen>
  );
}

import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { deleteAccount } from "@/lib/auth";
import { usePendingWrites } from "@/lib/connection";
import { friendlyError } from "@/lib/error-copy";
import {
  canDeleteAccount,
  DELETE_WORD,
  deleteAccountSummary,
  exportStepNote,
} from "./delete-account-rules";
import { useExportData } from "./use-export-data";

const COPY_CONFIRM_LABEL = "I've checked my copy is saved, or I don't need one";

/**
 * The one action that can't be undone, so it gets its own page: what goes, a copy
 * first, then a typed confirmation before anything is sent.
 */
export function DeleteAccountScreen() {
  const pending = usePendingWrites();
  const { busy: exporting, shared, exportData } = useExportData();
  const [typed, setTyped] = useState("");
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = canDeleteAccount(typed, copyConfirmed);

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      // On success the session ends and the app returns to the login screen.
      await deleteAccount();
    } catch (e) {
      setError(friendlyError(e));
      setDeleting(false);
    }
  };

  return (
    <Screen title="Delete account" tabBarPadding={false}>
      <Text tone="muted">{deleteAccountSummary(pending)}</Text>
      <Section title="1. Keep a copy">
        <Card className="gap-3">
          <Text tone="muted">{exportStepNote(shared)}</Text>
          <Button
            label="Export all data"
            icon="download"
            variant="secondary"
            loading={exporting}
            onPress={exportData}
          />
          <View className="flex-row items-center gap-2">
            <Checkbox
              checked={copyConfirmed}
              onChange={setCopyConfirmed}
              label={COPY_CONFIRM_LABEL}
            />
            <Text className="flex-1" onPress={() => setCopyConfirmed(!copyConfirmed)}>
              {COPY_CONFIRM_LABEL}
            </Text>
          </View>
        </Card>
      </Section>
      <Section title="2. Confirm">
        <Card className="gap-3">
          <TextField
            label={`Type ${DELETE_WORD} to confirm`}
            value={typed}
            onChangeText={setTyped}
            autoCapitalize="characters"
            autoCorrect={false}
            error={error ?? undefined}
          />
          <Button
            label="Delete my account"
            icon="delete-outline"
            variant="secondary"
            disabled={!confirmed}
            loading={deleting}
            onPress={() => void remove()}
          />
        </Card>
      </Section>
    </Screen>
  );
}

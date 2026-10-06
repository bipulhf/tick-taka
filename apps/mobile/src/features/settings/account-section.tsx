import { Image } from "expo-image";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { deleteAccount, profileStore } from "@/lib/auth";
import { friendlyError } from "@/lib/error-copy";
import { plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { outbox } from "@/lib/outbox";
import { useStore } from "@/lib/store";
import { confirmSignOut } from "./confirm-sign-out";

/** The Google account this space belongs to, and the way out of it. */
export function AccountSection() {
  const profile = useStore(profileStore);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch (error) {
      notify(friendlyError(error));
      setDeleting(false);
    }
  };

  const confirmDelete = () => {
    const pending = outbox.size;
    Alert.alert(
      "Delete your account?",
      `This permanently deletes your account and everything in it from the server: tasks, money records, receipt photos and backups${pending > 0 ? `, plus ${plural(pending, "change")} not yet synced` : ""}. It can't be undone. Export your data first if you want a copy.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void remove() },
      ],
    );
  };
  return (
    <Card className="gap-4">
      <View className="flex-row items-center gap-3">
        {profile?.pictureUrl ? (
          <Image
            source={{ uri: profile.pictureUrl }}
            style={{ width: 48, height: 48, borderRadius: 24 }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View className="h-12 w-12 items-center justify-center rounded-full bg-sky/15">
            <Icon name="account-outline" color="sky" />
          </View>
        )}
        <View className="flex-1">
          <Text variant="strong" numberOfLines={1}>
            {profile?.name ?? "Signed in with Google"}
          </Text>
          {profile ? (
            <Text variant="callout" tone="muted" numberOfLines={1}>
              {profile.email}
            </Text>
          ) : null}
        </View>
      </View>
      <Button label="Sign out" icon="logout" variant="secondary" onPress={confirmSignOut} />
      <Button
        label="Delete account"
        icon="delete-outline"
        variant="ghost"
        size="sm"
        loading={deleting}
        onPress={confirmDelete}
      />
    </Card>
  );
}

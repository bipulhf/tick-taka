import { Image } from "expo-image";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { profileStore, signOut } from "@/lib/auth";
import { useStore } from "@/lib/store";

/** The Google account this space belongs to, and the way out of it. */
export function AccountSection() {
  const profile = useStore(profileStore);
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
      <Button label="Sign out" icon="logout" variant="secondary" onPress={() => void signOut()} />
    </Card>
  );
}

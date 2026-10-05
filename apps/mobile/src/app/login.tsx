import type { TikiMood } from "@tick-taka/shared/tiki";
import { useState } from "react";
import { KeyboardAvoidingView, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { signIn } from "@/lib/auth";
import { API_URL } from "@/lib/config";
import type { ColorName } from "@/theme/colors";

const HIGHLIGHTS: { label: string; icon: IconName; color: ColorName }[] = [
  { label: "Tasks", icon: "checkbox-marked-circle-outline", color: "sky" },
  { label: "Money", icon: "wallet-outline", color: "mint" },
  { label: "Habits", icon: "repeat", color: "grape" },
];

const TINT: Partial<Record<ColorName, string>> = {
  sky: "bg-sky/15",
  mint: "bg-mint/15",
  grape: "bg-grape/15",
};

const SERVER_HOST = API_URL.replace(/^https?:\/\//, "");

/** One password between you and your day: Tiki up top, the field and button in thumb reach. */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mood: TikiMood = busy ? "focused" : error ? "calm" : password ? "curious" : "happy";

  const submit = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn(password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-between gap-8 px-5"
        contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-5 pt-6">
          <View className="h-48 w-48 items-center justify-center rounded-full bg-mango/20">
            <Tiki mood={mood} size={136} />
          </View>
          <View className="items-center gap-2">
            <Text variant="largeTitle" accessibilityRole="header">
              Tick & Taka
            </Text>
            <Text tone="muted" className="text-center">
              Your days and your money, on one screen.
            </Text>
          </View>
          <View className="flex-row gap-2">
            {HIGHLIGHTS.map((item) => (
              <View
                key={item.label}
                className="flex-row items-center gap-1.5 rounded-full bg-card py-2 pl-2 pr-3"
              >
                <View
                  className={`h-7 w-7 items-center justify-center rounded-full ${TINT[item.color]}`}
                >
                  <Icon name={item.icon} size={16} color={item.color} />
                </View>
                <Text variant="caption">{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="gap-4 rounded-4xl bg-card p-5">
          <View className="gap-1">
            <Text variant="heading">Welcome back</Text>
            <Text variant="callout" tone="muted">
              Enter your password to unlock.
            </Text>
          </View>
          <TextField
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (error) setError(null);
            }}
            placeholder="Password"
            accessibilityLabel="Password"
            secureTextEntry
            autoFocus
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          {error ? (
            <View
              accessibilityLiveRegion="polite"
              className="flex-row items-start gap-3 rounded-2xl bg-coral/10 p-3"
            >
              <Icon name="alert-circle-outline" size={22} color="coral" />
              <Text variant="callout" className="flex-1">
                {error}
              </Text>
            </View>
          ) : null}
          <Button
            label="Unlock"
            icon="lock-open-variant-outline"
            onPress={submit}
            loading={busy}
            disabled={!password}
          />
        </View>

        <View className="flex-row items-center justify-center gap-1.5">
          <Icon name="server-network" size={14} color="muted" />
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {SERVER_HOST}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

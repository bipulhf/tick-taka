import type { TikiMood } from "@tick-taka/shared/tiki";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { GoogleLogo } from "@/components/ui/google-logo";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { confirmSignOut } from "@/features/settings/confirm-sign-out";
import { ApiError } from "@/lib/api";
import {
  profileStore,
  SCREENSHOT_BUILD,
  SignInCancelled,
  signedOutNoticeStore,
  signInForScreenshots,
  signInWithGoogle,
} from "@/lib/auth";
import { API_URL } from "@/lib/config";
import { usePendingWrites } from "@/lib/connection";
import { friendlyError } from "@/lib/error-copy";
import { plural } from "@/lib/format";
import { haptic } from "@/lib/haptics";
import { ServerUnreachableError } from "@/lib/http";
import { useStore } from "@/lib/store";
import { type ColorName, useColors } from "@/theme/colors";

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

/** One tap between you and your day: Tiki up top, Google sign-in in thumb reach. */
export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Screenshot builds sign in from a link (ticktaka://login?demoToken=…); see lib/auth.ts.
  const { demoToken } = useLocalSearchParams<{ demoToken?: string }>();
  useEffect(() => {
    if (SCREENSHOT_BUILD && demoToken)
      signInForScreenshots(demoToken).catch((e: Error) => setError(e.message));
  }, [demoToken]);
  // A profile without a token: the session expired and this phone still holds their data.
  const expired = useStore(profileStore);
  // Set after the account was deleted, so the person knows it worked.
  const notice = useStore(signedOutNoticeStore);
  const pending = usePendingWrites();
  const mood: TikiMood = busy ? "focused" : error ? "calm" : "happy";

  const submit = async () => {
    if (busy) return;
    haptic.tap();
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      // Google's errors are already in words; the API's go through the shared copy.
      if (e instanceof ApiError || e instanceof ServerUnreachableError)
        setError(friendlyError(e, "signIn"));
      else if (!(e instanceof SignInCancelled)) setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-grow justify-between gap-8 px-5"
        contentContainerStyle={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 20 }}
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
          {expired ? (
            <View className="gap-1" accessibilityLiveRegion="polite">
              <Text variant="heading">Sign in again</Text>
              <Text variant="callout" tone="muted">
                {`Your session ended. Sign in as ${expired.email} to carry on${pending > 0 ? ` and send the ${plural(pending, "change")} waiting on this phone` : ""}. Signing in with another account removes ${expired.name ?? expired.email}'s data from this phone.`}
              </Text>
            </View>
          ) : notice ? (
            <View className="gap-1" accessibilityLiveRegion="polite">
              <Text variant="heading">Account deleted</Text>
              <Text variant="callout" tone="muted">
                {`${notice} Sign in with Google any time to start a new space.`}
              </Text>
            </View>
          ) : (
            <View className="gap-1">
              <Text variant="heading">Welcome</Text>
              <Text variant="callout" tone="muted">
                Sign in with your Google account. New here? This sets up your own space.
              </Text>
            </View>
          )}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={submit}
            className="min-h-[52px] flex-row items-center justify-center gap-3 rounded-2xl border border-line bg-background px-6 active:opacity-80"
          >
            {busy ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <GoogleLogo size={22} />
                <Text variant="strong">Continue with Google</Text>
              </>
            )}
          </Pressable>
          <Text variant="caption" tone="muted" className="text-center">
            Your tasks and money stay private to your account.
          </Text>
          {expired ? (
            <Button
              label="Sign out instead"
              variant="ghost"
              size="sm"
              onPress={() => void confirmSignOut()}
            />
          ) : null}
        </View>

        {__DEV__ ? (
          // Which API a development build talks to; release builds don't show it.
          <View className="flex-row items-center justify-center gap-1.5">
            <Icon name="server-network" size={14} color="muted" />
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {SERVER_HOST}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

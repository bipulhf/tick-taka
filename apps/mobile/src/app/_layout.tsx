import "@/lib/polyfills";
import "../global.css";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/nunito";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { type ErrorBoundaryProps, Stack, useRouter, useSegments } from "expo-router";
import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router/react-navigation";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConfettiLayer } from "@/components/ui/confetti";
import { Snackbar } from "@/components/ui/snackbar";
import { AppServices } from "@/features/app/app-services";
import { ErrorScreen } from "@/features/app/error-screen";
import { loadFocusSession } from "@/features/focus/focus-session";
import { AppLock } from "@/features/security/app-lock";
import { loadAppLockPref } from "@/features/security/app-lock-pref";
import { loadThemeChoice, ThemedRoot } from "@/features/settings/themed-root";
import { loadToken, tokenStore } from "@/lib/auth";
import { EXPORT_KEEP_MS } from "@/lib/export-file";
import { sweepExports } from "@/lib/export-sweep";
import { loadFeedbackPrefs } from "@/lib/feedback-prefs";
import { startOutbox } from "@/lib/outbox";
import { loadPrivacy } from "@/lib/privacy";
import { CACHE_BUSTER, PERSIST_MAX_AGE, persister, queryClient } from "@/lib/query-client";
import { restoreServerClock } from "@/lib/server-clock";
import { preloadSounds } from "@/lib/sounds";
import { useStore } from "@/lib/store";
import { palette } from "@/theme/palette";

void SplashScreen.preventAutoHideAsync();

/** Any render error below the root shows a way out instead of crashing the app. */
export function ErrorBoundary(props: ErrorBoundaryProps) {
  void SplashScreen.hideAsync();
  return <ErrorScreen {...props} />;
}

const sheet = {
  presentation: "formSheet" as const,
  sheetGrabberVisible: false,
  // One detent: the sheet content is laid out at its largest height, so a second,
  // smaller detent would hide the footer buttons.
  sheetAllowedDetents: [0.92],
  sheetCornerRadius: 28,
};

/**
 * Stack.Protected only guards the screens listed under it; a pushed screen like
 * Settings would stay on top after sign-out. This sends any signed-out view to login.
 */
function SignedOutRedirect({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const segments = useSegments();
  useEffect(() => {
    if (!signedIn && segments[0] !== "login") router.replace("/login");
  }, [signedIn, segments, router]);
  return null;
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const colors = scheme === "dark" ? palette.dark : palette.light;
  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const token = useStore(tokenStore);
  const ready = fontsLoaded && token !== undefined;

  useEffect(() => {
    // Belt and braces: whatever happens, leave the splash screen for login.
    loadToken().catch(() => tokenStore.set(null));
    void restoreServerClock(AsyncStorage);
    void startOutbox();
    sweepExports(EXPORT_KEEP_MS);
    void loadAppLockPref();
    void loadPrivacy();
    void loadFeedbackPrefs();
    preloadSounds();
    void loadFocusSession();
    void loadThemeChoice();
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister,
            maxAge: PERSIST_MAX_AGE,
            buster: CACHE_BUSTER,
            // Queued writes live in the outbox's own storage, not in this cache.
            dehydrateOptions: { shouldDehydrateMutation: () => false },
          }}
        >
          <ThemeProvider
            value={{
              ...base,
              colors: {
                ...base.colors,
                background: colors.background,
                card: colors.card,
                text: colors.ink,
                primary: colors.mango,
                border: colors.line,
              },
            }}
          >
            <StatusBar style={scheme === "dark" ? "light" : "dark"} />
            <ThemedRoot>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                }}
              >
                <Stack.Protected guard={Boolean(token)}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="add" options={sheet} />
                  {/* Full screen, not a sheet: scrolling back through the chat must never drag it closed. */}
                  <Stack.Screen
                    name="assistant"
                    options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
                  />
                  <Stack.Screen name="task/[id]" options={sheet} />
                  <Stack.Screen name="pick-top-three" options={sheet} />
                  <Stack.Screen name="habit/[id]" options={sheet} />
                  <Stack.Screen name="time-entry" options={sheet} />
                  <Stack.Screen name="transaction/[id]" options={sheet} />
                  <Stack.Screen name="account/[id]" options={sheet} />
                  <Stack.Screen name="goal/[id]" options={sheet} />
                  <Stack.Screen name="debt/[id]" options={sheet} />
                  <Stack.Screen name="project/[id]" options={sheet} />
                  <Stack.Screen name="area/[id]" options={sheet} />
                  <Stack.Screen name="category/[id]" options={sheet} />
                  <Stack.Screen name="event/[id]" options={sheet} />
                  <Stack.Screen name="shopping-item/[id]" options={sheet} />
                  <Stack.Screen name="budget-edit" options={sheet} />
                  <Stack.Screen name="money/recurring/[id]" options={sheet} />
                  <Stack.Screen
                    name="focus"
                    options={{ presentation: "fullScreenModal", animation: "slide_from_bottom" }}
                  />
                </Stack.Protected>
                <Stack.Protected guard={!token}>
                  <Stack.Screen name="login" />
                </Stack.Protected>
              </Stack>
              <SignedOutRedirect signedIn={Boolean(token)} />
              {token ? (
                <>
                  <AppServices />
                  <AppLock />
                </>
              ) : null}
              <Snackbar />
              <ConfettiLayer />
            </ThemedRoot>
          </ThemeProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

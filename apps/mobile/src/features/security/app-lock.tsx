import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { appLockPref, saveAppLockPref } from "./app-lock-pref";
import { coldStartLocked } from "./lock-decision";

/** Fingerprint or face lock on a cold start, and after the app sits in the background a while. */
export function AppLock() {
  const { data: settings } = useSettings();
  const pref = useStore(appLockPref);
  const enabled = settings?.appLock ?? pref ?? false;
  const lockAfterMs = (settings?.lockAfterMinutes ?? 5) * 60_000;
  /** null until the cold-start decision is made. */
  const [locked, setLocked] = useState<boolean | null>(null);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Tick & Taka",
    });
    if (result.success) setLocked(false);
  }, []);

  // Cold start: decide from the phone's copy of the setting, before settings load.
  useEffect(() => {
    if (locked !== null || pref === undefined) return;
    const decision = coldStartLocked(pref, settings?.appLock);
    if (decision !== null) setLocked(decision);
  }, [locked, pref, settings?.appLock]);

  // Keep the phone's copy in step with the setting; turning it off unlocks.
  useEffect(() => {
    if (settings === undefined) return;
    saveAppLockPref(settings.appLock);
    if (!settings.appLock) setLocked(false);
  }, [settings]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "background") backgroundedAt.current = Date.now();
      if (status === "active" && enabled && backgroundedAt.current !== null) {
        if (Date.now() - backgroundedAt.current >= lockAfterMs) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [enabled, lockAfterMs]);

  useEffect(() => {
    if (locked) void unlock();
  }, [locked, unlock]);

  // While the phone's copy is still being read, cover the screen rather than flash it.
  const reading = locked === null && pref === undefined;
  if (!locked && !reading) return null;
  return (
    <View className="absolute inset-0 items-center justify-center gap-4 bg-background px-8">
      {reading ? null : (
        <>
          <Tiki mood="sleepy" size={110} />
          <Text variant="title">Locked</Text>
          <Button label="Unlock" icon="fingerprint" onPress={unlock} />
        </>
      )}
    </View>
  );
}

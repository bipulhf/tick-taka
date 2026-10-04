import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { useSettings } from "@/lib/queries";

/** Fingerprint or face lock after the app sits in the background for a while. */
export function AppLock() {
  const { data: settings } = useSettings();
  const enabled = settings?.appLock ?? false;
  const lockAfterMs = (settings?.lockAfterMinutes ?? 5) * 60_000;
  const [locked, setLocked] = useState(enabled);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Tick & Taka",
    });
    if (result.success) setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled) setLocked(false);
  }, [enabled]);

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

  if (!locked || !enabled) return null;
  return (
    <View className="absolute inset-0 items-center justify-center gap-4 bg-background px-8">
      <Tiki mood="sleepy" size={110} />
      <Text variant="title">Locked</Text>
      <Button label="Unlock" icon="fingerprint" onPress={unlock} />
    </View>
  );
}

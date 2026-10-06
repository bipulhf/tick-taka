import type { ErrorBoundaryProps } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { persister, queryClient } from "@/lib/query-client";
import { useColors } from "@/theme/colors";

/**
 * Shown instead of a white screen when something throws while rendering. Built from
 * plain React Native views with inline styles, so it works even when the crash is
 * in the providers that set up fonts and theme classes. Resetting the cache keeps
 * the outbox, which has its own storage: queued writes are never lost here.
 */
export function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);

  const resetCache = async () => {
    setBusy(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await persister.removeClient();
    } finally {
      setBusy(false);
      await retry();
    }
  };

  const button = (label: string, onPress: () => void, primary: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={{
        minHeight: 52,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 24,
        backgroundColor: primary ? colors.mango : "transparent",
        borderWidth: primary ? 0 : 1,
        borderColor: colors.line,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: "700", color: primary ? "#23202B" : colors.ink }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        gap: 16,
        padding: 24,
        backgroundColor: colors.background,
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 24, fontWeight: "800", color: colors.ink }}
      >
        Something went wrong
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 21, color: colors.muted }}>
        This screen hit an error. Your saved changes are safe, including ones waiting to sync. Try
        again, or reset the cached screens if it keeps happening; they reload from the server.
      </Text>
      <Text selectable numberOfLines={3} style={{ fontSize: 13, color: colors.muted }}>
        {error.message}
      </Text>
      {button("Try again", () => void retry(), true)}
      {button("Reset cached data", () => void resetCache(), false)}
    </View>
  );
}

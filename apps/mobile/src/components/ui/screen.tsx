import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/theme/colors";
import { Icon } from "./icon";
import { Text } from "./text";

export interface ScreenProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra space for the tab bar; screens pushed on top of the tabs get a back button instead. */
  tabBarPadding?: boolean;
  scroll?: boolean;
}

export function Screen({
  title,
  subtitle,
  right,
  children,
  refreshing,
  onRefresh,
  tabBarPadding = true,
  scroll = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const router = useRouter();
  const showBack = !tabBarPadding && router.canGoBack();
  const header = title ? (
    <View className="flex-row items-end justify-between gap-3 px-1 pb-2">
      {showBack ? (
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="-ml-2 h-12 w-10 items-center justify-center self-start"
        >
          <Icon name="chevron-left" size={30} />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text variant="largeTitle" accessibilityRole="header" numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="callout" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  ) : null;
  const padding = {
    paddingTop: insets.top + 12,
    paddingBottom: (tabBarPadding ? 110 : 32) + insets.bottom,
  };
  // Content scrolls under a solid strip, so it never collides with the status bar.
  const statusBackdrop = (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 top-0 bg-background"
      style={{ height: insets.top }}
    />
  );
  if (!scroll) {
    return (
      <View className="flex-1 gap-5 bg-background px-5" style={padding}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-7 px-5"
        contentContainerStyle={padding}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={colors.mango}
              colors={[colors.mango]}
            />
          ) : undefined
        }
      >
        {header}
        {children}
      </ScrollView>
      {statusBackdrop}
    </View>
  );
}

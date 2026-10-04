import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/theme/colors";
import { Text } from "./text";

export interface ScreenProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Extra space for the tab bar. */
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
  const header = title ? (
    <View className="flex-row items-end justify-between gap-3 px-1 pb-2">
      <View className="flex-1">
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  ) : null;
  const padding = {
    paddingTop: insets.top + 12,
    paddingBottom: (tabBarPadding ? 110 : 32) + insets.bottom,
  };
  if (!scroll) {
    return (
      <View className="flex-1 gap-4 bg-background px-4" style={padding}>
        {header}
        {children}
      </View>
    );
  }
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-5 px-4"
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
  );
}

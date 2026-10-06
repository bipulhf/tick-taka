import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { choiceA11y } from "@/components/ui/a11y-actions";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AssistantButton, useAssistantAvailable } from "@/features/assistant/assistant-button";
import { haptic } from "@/lib/haptics";
import { useColors } from "@/theme/colors";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The bar floats this far above the safe area, and is this tall. */
export const TAB_BAR_GAP = 12;
export const TAB_BAR_HEIGHT = 64;

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: "Today", icon: "white-balance-sunny", activeIcon: "white-balance-sunny" },
  plan: { label: "Plan", icon: "calendar-blank-outline", activeIcon: "calendar-check" },
  money: { label: "Money", icon: "wallet-outline", activeIcon: "wallet" },
  review: { label: "Review", icon: "chart-donut", activeIcon: "chart-donut-variant" },
};

/**
 * A floating capsule of four equal tabs, each an icon over its name; the open tab
 * is marked by colour and a soft pill, never by growing, so the row never crowds.
 * Quick-add sits in the middle within thumb reach. Tiki's chat button sits beside
 * it on the left, so it never covers the content.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useColors();
  const chat = useAssistantAvailable();
  const routes = state.routes.filter((route) => TABS[route.name]);
  const renderTab = (route: (typeof routes)[number]) => {
    const tab = TABS[route.name];
    if (!tab) return null;
    const focused = state.routes[state.index]?.key === route.key;
    return (
      <Pressable
        key={route.key}
        {...choiceA11y("tab", focused)}
        accessibilityLabel={tab.label}
        className="min-h-12 flex-1 items-center justify-center gap-0.5"
        onPress={() => {
          haptic.select();
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        }}
      >
        <View
          // Remount on focus change: Android keeps square corners when only the fill changes.
          key={focused ? "on" : "off"}
          className="h-8 w-12 items-center justify-center"
          style={{ borderRadius: 16, backgroundColor: focused ? colors.line : "transparent" }}
        >
          <Icon
            name={focused ? tab.activeIcon : tab.icon}
            color={focused ? "ink" : "muted"}
            size={26}
          />
        </View>
        <Text
          tone={focused ? "ink" : "muted"}
          // Chrome: grows with the font size, but only so far, so four labels still fit.
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          adjustsFontSizeToFit
          className={`${focused ? "font-nunito-bold" : "font-nunito-semibold"} text-[12px] leading-4`}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <>
      {/* Content fades out under the capsule instead of peeking out below it. */}
      <LinearGradient
        pointerEvents="none"
        colors={[`${colors.background}00`, colors.background]}
        locations={[0, 0.55]}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: insets.bottom + TAB_BAR_GAP + TAB_BAR_HEIGHT + 28,
        }}
      />
      <View
        className="absolute left-4 right-4 flex-row items-center gap-2"
        style={{ bottom: insets.bottom + TAB_BAR_GAP, height: TAB_BAR_HEIGHT }}
      >
        {chat ? <AssistantButton size={TAB_BAR_HEIGHT} /> : null}
        <View
          // The four tabs are one tab list; quick-add sits among them as a plain button.
          accessibilityRole="tablist"
          className="h-full flex-1 flex-row items-center rounded-full border border-line bg-card px-1"
          style={{ elevation: 10 }}
        >
          {routes.slice(0, 2).map(renderTab)}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quick add"
            onPress={() => {
              haptic.tap();
              router.push("/add");
            }}
            className="h-14 w-14 items-center justify-center rounded-full bg-mango active:scale-95"
          >
            <Icon name="plus" size={30} color="onAccent" />
          </Pressable>
          {routes.slice(2).map(renderTab)}
        </View>
      </View>
    </>
  );
}

import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { Tabs } from "expo-router/js-tabs";
import { type ComponentProps, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { AssistantButton, useAssistantAvailable } from "@/features/assistant/assistant-button";
import { useSmsPendingCount } from "@/features/sms/use-sms-pending";
import { haptic } from "@/lib/haptics";
import { useColors } from "@/theme/colors";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The bar floats this far above the safe area, and is this tall. */
export const TAB_BAR_GAP = 12;
export const TAB_BAR_HEIGHT = 64;
/** Below this capsule width the open tab shows its icon only. */
const COMPACT_WIDTH = 300;

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: "Today", icon: "white-balance-sunny", activeIcon: "white-balance-sunny" },
  plan: { label: "Plan", icon: "calendar-blank-outline", activeIcon: "calendar-check" },
  money: { label: "Money", icon: "wallet-outline", activeIcon: "wallet" },
  review: { label: "Review", icon: "chart-donut", activeIcon: "chart-donut-variant" },
};

/**
 * A floating capsule: the open tab grows into a labelled pill, the others stay
 * as calm icons, and quick-add sits in the middle within thumb reach. Tiki's
 * chat button sits beside it on the left, so it never covers the content.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const smsPending = useSmsPendingCount();
  const colors = useColors();
  const chat = useAssistantAvailable();
  const [capsuleWidth, setCapsuleWidth] = useState(0);
  const compact = capsuleWidth > 0 && capsuleWidth < COMPACT_WIDTH;
  const routes = state.routes.filter((route) => TABS[route.name]);
  const renderTab = (route: (typeof routes)[number]) => {
    const tab = TABS[route.name]!;
    const focused = state.routes[state.index]?.key === route.key;
    const badge = route.name === "money" ? smsPending : 0;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={badge ? `${tab.label}, ${badge} new` : tab.label}
        className="h-12 min-w-12 items-center justify-center"
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
          className="h-12 flex-row items-center justify-center gap-2"
          style={{
            borderRadius: 24,
            paddingHorizontal: focused && !compact ? 16 : 10,
            backgroundColor: focused ? colors.ink : "transparent",
          }}
        >
          <Icon
            name={focused ? tab.activeIcon : tab.icon}
            color={focused ? "background" : "muted"}
            size={24}
          />
          {focused && !compact ? (
            <Text variant="callout" tone="background" className="font-nunito-bold">
              {tab.label}
            </Text>
          ) : null}
          {badge > 0 ? (
            <View className="absolute right-0.5 top-1 min-w-5 items-center rounded-full bg-coral px-1">
              <Text className="text-[11px] font-nunito-bold text-white">{badge}</Text>
            </View>
          ) : null}
        </View>
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
          onLayout={(event) => setCapsuleWidth(event.nativeEvent.layout.width)}
          className="h-full flex-1 flex-row items-center justify-between rounded-full border border-line bg-card px-2"
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
            className="h-12 w-12 items-center justify-center rounded-full bg-mango active:scale-95"
          >
            <Icon name="plus" size={30} color="onAccent" />
          </Pressable>
          {routes.slice(2).map(renderTab)}
        </View>
      </View>
    </>
  );
}

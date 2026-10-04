import { useRouter } from "expo-router";
import type { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useSmsPendingCount } from "@/features/sms/use-sms-pending";
import { haptic } from "@/lib/haptics";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

/** The capsule floats this far above the safe area, and is this tall. */
export const TAB_BAR_GAP = 12;
export const TAB_BAR_HEIGHT = 64;

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: "Today", icon: "white-balance-sunny", activeIcon: "white-balance-sunny" },
  plan: { label: "Plan", icon: "calendar-blank-outline", activeIcon: "calendar-check" },
  money: { label: "Money", icon: "wallet-outline", activeIcon: "wallet" },
  review: { label: "Review", icon: "chart-donut", activeIcon: "chart-donut-variant" },
};

const grow = LinearTransition.duration(220);

/**
 * A floating capsule: the open tab grows into a labelled pill, the others stay
 * as calm icons, and quick-add sits in the middle within thumb reach.
 */
export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const smsPending = useSmsPendingCount();
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
        <Animated.View
          layout={grow}
          className={`h-12 flex-row items-center justify-center gap-2 rounded-full ${focused ? "bg-ink px-4" : "bg-transparent px-3"}`}
        >
          <Icon
            name={focused ? tab.activeIcon : tab.icon}
            color={focused ? "background" : "muted"}
            size={24}
          />
          {focused ? (
            <Text variant="callout" tone="background" className="font-nunito-bold">
              {tab.label}
            </Text>
          ) : null}
          {badge > 0 ? (
            <View className="absolute right-0.5 top-1 min-w-5 items-center rounded-full bg-coral px-1">
              <Text className="text-[11px] font-nunito-bold text-white">{badge}</Text>
            </View>
          ) : null}
        </Animated.View>
      </Pressable>
    );
  };
  return (
    <View
      className="absolute left-4 right-4 flex-row items-center justify-between rounded-full border border-line bg-card px-2"
      style={{ bottom: insets.bottom + TAB_BAR_GAP, height: TAB_BAR_HEIGHT, elevation: 10 }}
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
  );
}

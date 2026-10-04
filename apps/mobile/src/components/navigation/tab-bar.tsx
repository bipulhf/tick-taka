import { useRouter } from "expo-router";
import type { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { haptic } from "@/lib/haptics";

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: "Today", icon: "white-balance-sunny", activeIcon: "white-balance-sunny" },
  plan: { label: "Plan", icon: "calendar-blank-outline", activeIcon: "calendar-check" },
  money: { label: "Money", icon: "wallet-outline", activeIcon: "wallet" },
  review: { label: "Review", icon: "chart-donut", activeIcon: "chart-donut-variant" },
};

/** Five slots with quick-add in the centre, so capture is always one thumb-tap away. */
export function TabBar({
  state,
  navigation,
  badges = {},
}: TabBarProps & { badges?: Record<string, number> }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routes = state.routes.filter((route) => TABS[route.name]);
  const renderTab = (route: (typeof routes)[number]) => {
    const tab = TABS[route.name]!;
    const focused = state.routes[state.index]?.key === route.key;
    const badge = badges[route.name] ?? 0;
    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={badge ? `${tab.label}, ${badge} new` : tab.label}
        className="min-h-14 flex-1 items-center justify-center gap-0.5"
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
        <View>
          <Icon
            name={focused ? tab.activeIcon : tab.icon}
            color={focused ? "ink" : "muted"}
            size={24}
          />
          {badge > 0 ? (
            <View className="absolute -right-2 -top-1 min-w-4 items-center rounded-full bg-coral px-1">
              <Text className="text-[10px] font-nunito-bold text-white">{badge}</Text>
            </View>
          ) : null}
        </View>
        <Text
          variant="caption"
          className={`text-[11px] ${focused ? "font-nunito-bold" : ""}`}
          tone={focused ? "ink" : "muted"}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-center border-t border-line bg-card px-2"
      style={{ paddingBottom: insets.bottom + 4, paddingTop: 6 }}
    >
      {routes.slice(0, 2).map(renderTab)}
      <View className="flex-1 items-center">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick add"
          onPress={() => {
            haptic.tap();
            router.push("/add");
          }}
          className="-mt-6 h-16 w-16 items-center justify-center rounded-full bg-mango active:scale-95"
          style={{ elevation: 6 }}
        >
          <Icon name="plus" size={32} color="ink" />
        </Pressable>
      </View>
      {routes.slice(2).map(renderTab)}
    </View>
  );
}

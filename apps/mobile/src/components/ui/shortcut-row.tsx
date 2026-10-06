import { Pressable, View } from "react-native";
import { haptic } from "@/lib/haptics";
import type { ColorName } from "@/theme/colors";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

export interface Shortcut {
  label: string;
  icon: IconName;
  color: ColorName;
  onPress: () => void;
  badge?: number;
}

const TINT: Partial<Record<ColorName, string>> = {
  sky: "bg-sky/15",
  mint: "bg-mint/15",
  coral: "bg-coral/15",
  grape: "bg-grape/15",
  mango: "bg-mango/20",
};

/** Up to four big round shortcuts, like a phone's quick actions. */
export function ShortcutRow({ items }: { items: Shortcut[] }) {
  return (
    <View className="flex-row justify-between">
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => {
            haptic.select();
            item.onPress();
          }}
          accessibilityRole="button"
          accessibilityLabel={item.badge ? `${item.label}, ${item.badge} new` : item.label}
          className="w-[23%] items-center gap-2 active:opacity-70"
        >
          <View
            className={`h-16 w-16 items-center justify-center rounded-3xl ${TINT[item.color] ?? "bg-card"}`}
          >
            <Icon name={item.icon} size={28} color={item.color} />
            {item.badge ? (
              <View className="absolute -right-1 -top-1 min-w-6 items-center rounded-full bg-coral px-1.5">
                <Text
                  variant="caption"
                  tone="onAccent"
                  className="font-nunito-bold"
                  maxFontSizeMultiplier={1.3}
                >
                  {item.badge}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="caption" className="text-center" numberOfLines={1}>
            {item.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

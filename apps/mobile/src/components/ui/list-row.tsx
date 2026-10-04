import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { ColorName } from "@/theme/colors";
import { Icon, type IconName } from "./icon";
import { Text } from "./text";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  emoji?: string;
  icon?: IconName;
  iconColor?: ColorName;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}

const TINT: Partial<Record<ColorName, string>> = {
  sky: "bg-sky/15",
  mint: "bg-mint/15",
  coral: "bg-coral/15",
  grape: "bg-grape/15",
  mango: "bg-mango/20",
};

/** A 60 dp list row: leading icon, title and subtitle, one trailing value or chevron. */
export function ListRow({
  title,
  subtitle,
  emoji,
  icon,
  iconColor = "muted",
  right,
  onPress,
  chevron,
}: ListRowProps) {
  const leading = emoji ? (
    <View className="h-10 w-10 items-center justify-center rounded-full bg-background">
      <Text className="text-xl">{emoji}</Text>
    </View>
  ) : icon ? (
    <View
      className={`h-10 w-10 items-center justify-center rounded-full ${TINT[iconColor] ?? "bg-background"}`}
    >
      <Icon name={icon} size={22} color={iconColor} />
    </View>
  ) : null;
  const body = (
    <View className="min-h-[60px] flex-row items-center gap-3 px-4 py-3">
      {leading}
      <View className="flex-1">
        <Text variant="strong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="callout" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" color="muted" /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:bg-line/40">
      {body}
    </Pressable>
  ) : (
    body
  );
}

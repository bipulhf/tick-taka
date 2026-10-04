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
  const body = (
    <View className="min-h-14 flex-row items-center gap-3 py-2">
      {emoji ? (
        <Text className="text-2xl">{emoji}</Text>
      ) : icon ? (
        <Icon name={icon} color={iconColor} />
      ) : null}
      <View className="flex-1">
        <Text variant="strong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" color="muted" /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" className="active:opacity-70">
      {body}
    </Pressable>
  ) : (
    body
  );
}

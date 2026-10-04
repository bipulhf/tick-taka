import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "./text";

export function Section({
  title,
  action,
  onAction,
  children,
  className,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View className={`gap-3 ${className ?? ""}`}>
      <View className="min-h-8 flex-row items-end justify-between px-1">
        <Text variant="heading" accessibilityRole="header">
          {title}
        </Text>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={14} accessibilityRole="button">
            <Text variant="callout" className="font-nunito-bold" tone="sky">
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

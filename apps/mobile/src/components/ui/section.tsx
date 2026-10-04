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
      <View className="flex-row items-center justify-between px-1">
        <Text variant="label" tone="muted">
          {title}
        </Text>
        {action && onAction ? (
          <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
            <Text variant="caption" className="font-nunito-bold" tone="sky">
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

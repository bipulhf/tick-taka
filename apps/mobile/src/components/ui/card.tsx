import { Pressable, View, type ViewProps } from "react-native";

export interface CardProps extends ViewProps {
  className?: string;
  onPress?: () => void;
}

export function Card({ className, onPress, children, ...props }: CardProps) {
  const classes = `rounded-3xl bg-card p-4 ${className ?? ""}`;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${classes} active:opacity-80`}
        accessibilityRole="button"
        {...props}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View className={classes} {...props}>
      {children}
    </View>
  );
}

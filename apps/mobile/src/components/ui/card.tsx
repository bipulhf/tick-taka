import { Pressable, View, type ViewProps } from "react-native";
import { useSwipeRowA11y } from "./swipe-row";

export interface CardProps extends ViewProps {
  className?: string;
  onPress?: () => void;
}

/** A single raised surface. Use for heroes; lists of things belong in a Group. */
export function Card({ className, onPress, children, ...props }: CardProps) {
  const classes = `rounded-3xl bg-card p-5 ${className ?? ""}`;
  const swipeActions = useSwipeRowA11y(Boolean(onPress));
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${classes} active:opacity-80`}
        accessibilityRole="button"
        {...swipeActions}
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

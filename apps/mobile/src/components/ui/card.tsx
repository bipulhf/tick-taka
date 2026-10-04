import { Pressable, View, type ViewProps } from "react-native";

export interface CardProps extends ViewProps {
  className?: string;
  onPress?: () => void;
}

/** A single raised surface. Use for heroes; lists of things belong in a Group. */
export function Card({ className, onPress, children, ...props }: CardProps) {
  const classes = `rounded-3xl bg-card p-5 ${className ?? ""}`;
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

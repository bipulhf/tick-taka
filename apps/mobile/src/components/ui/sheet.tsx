import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./text";
import { useKeyboardHeight } from "./use-keyboard-height";

/** Body of a bottom-sheet route: creating and editing never open a full screen. */
export function Sheet({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  return (
    <View className="flex-1 bg-background" style={{ paddingBottom: keyboard }}>
      <View className="items-center pt-2">
        <View className="h-1.5 w-10 rounded-full bg-line" />
      </View>
      <ScrollView
        contentContainerClassName="gap-5 px-5 pt-3 pb-6"
        keyboardShouldPersistTaps="handled"
      >
        <Text variant="title" accessibilityRole="header">
          {title}
        </Text>
        {children}
      </ScrollView>
      {footer ? (
        <View
          className="gap-2 border-t border-line px-5 pt-3"
          style={{ paddingBottom: (keyboard ? 0 : insets.bottom) + 12 }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

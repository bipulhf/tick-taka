import { View } from "react-native";
import { useIsOnline, usePendingWrites } from "@/lib/connection";
import { plural } from "@/lib/format";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * A quiet line at the top of each screen while offline, so nothing looks broken:
 * what you see may be from earlier, and your changes are kept and will sync.
 */
export function SyncStatus() {
  const online = useIsOnline();
  const pending = usePendingWrites();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-2 self-start rounded-full bg-card px-3 py-2"
    >
      <Icon name="cloud-off-outline" size={18} color="muted" />
      <Text variant="caption" tone="muted">
        {pending > 0
          ? `Offline · ${plural(pending, "change")} will sync when you're back`
          : "Offline · showing what was saved earlier"}
      </Text>
    </View>
  );
}

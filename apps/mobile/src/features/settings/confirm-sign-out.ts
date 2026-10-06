import { Alert } from "react-native";
import { countPendingWidgetWrites } from "@/features/widget/widget-cache";
import { signOut } from "@/lib/auth";
import { plural } from "@/lib/format";
import { outbox } from "@/lib/outbox";

/**
 * Signing out wipes the phone, queued writes included, so it always asks first and
 * says how many changes haven't reached the server, widget taps included.
 */
export async function confirmSignOut(): Promise<void> {
  // Expenses logged on the widget while offline wait in their own list until the app opens.
  const pending = outbox.size + (await countPendingWidgetWrites().catch(() => 0));
  if (pending > 0) {
    Alert.alert(
      "Sign out with unsynced changes?",
      `${plural(pending, "change")} ${pending === 1 ? "hasn't" : "haven't"} reached the server yet. Signing out deletes ${pending === 1 ? "it" : "them"} from this phone for good.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Try syncing", onPress: () => outbox.kick() },
        { text: "Sign out anyway", style: "destructive", onPress: () => void signOut() },
      ],
    );
    return;
  }
  Alert.alert(
    "Sign out?",
    "This removes your data from this phone. It stays on the server: sign in again to get it back.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ],
  );
}

import { Pressable } from "react-native";
import { togglePrivacy, usePrivacy } from "@/lib/privacy";
import { Icon } from "./icon";

/** The eye that hides every amount on screen, and shows them again. */
export function PrivacyToggle() {
  const privacy = usePrivacy();
  return (
    <Pressable
      onPress={togglePrivacy}
      hitSlop={6}
      accessibilityRole="switch"
      accessibilityState={{ checked: privacy }}
      accessibilityLabel="Hide amounts"
      className="h-12 w-12 items-center justify-center"
    >
      <Icon name={privacy ? "eye-off-outline" : "eye-outline"} color="muted" />
    </Pressable>
  );
}

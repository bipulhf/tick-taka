import { Pressable } from "react-native";
import type { ColorName } from "@/theme/colors";
import { Icon, type IconName } from "./icon";

/**
 * - plain: a bare icon in a header or at the end of a row (month arrows, remove).
 * - round: a circle that shows a soft fill while pressed (sheet chrome: close, new chat).
 */
export type IconButtonShape = "plain" | "round";

const SHAPE: Record<IconButtonShape, string> = {
  plain: "",
  round: " rounded-full active:bg-line/40",
};

/**
 * An icon-only button with a 48 dp target. `label` is what a screen reader says,
 * so it names the action ("Next month", "Remove milk").
 */
export function IconButton({
  icon,
  label,
  onPress,
  shape = "plain",
  color,
  iconSize,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  shape?: IconButtonShape;
  color?: ColorName;
  iconSize?: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`h-12 w-12 items-center justify-center${SHAPE[shape]}`}
    >
      <Icon name={icon} color={color} size={iconSize} />
    </Pressable>
  );
}

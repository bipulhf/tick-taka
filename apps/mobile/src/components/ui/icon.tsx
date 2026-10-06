import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { type ColorName, useColors } from "@/theme/colors";
import { ON_ACCENT } from "@/theme/palette";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({
  name,
  size = 24,
  color = "ink",
}: {
  name: IconName;
  size?: number;
  /** "onAccent" for icons on mango or any other semantic fill: always dark. */
  color?: ColorName | "onAccent";
}) {
  const colors = useColors();
  const value = color === "onAccent" ? ON_ACCENT : colors[color];
  return <MaterialCommunityIcons name={name} size={size} color={value} />;
}

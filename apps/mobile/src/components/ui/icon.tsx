import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { type ColorName, useColors } from "@/theme/colors";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const ON_MANGO = "#23202B";

export function Icon({
  name,
  size = 24,
  color = "ink",
}: {
  name: IconName;
  size?: number;
  color?: ColorName | "white" | "onAccent";
}) {
  const colors = useColors();
  const value = color === "white" ? "#FFFFFF" : color === "onAccent" ? ON_MANGO : colors[color];
  return <MaterialCommunityIcons name={name} size={size} color={value} />;
}

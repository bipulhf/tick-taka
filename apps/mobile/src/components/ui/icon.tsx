import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { type ColorName, useColors } from "@/theme/colors";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({
  name,
  size = 22,
  color = "ink",
}: {
  name: IconName;
  size?: number;
  color?: ColorName | "white";
}) {
  const colors = useColors();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={color === "white" ? "#FFFFFF" : colors[color]}
    />
  );
}

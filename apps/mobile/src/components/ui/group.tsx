import { Children, Fragment, isValidElement, type ReactNode } from "react";
import { View } from "react-native";

/**
 * Grouped list: one rounded surface with hairlines between rows, the calm
 * alternative to stacking separate cards.
 */
export function Group({
  children,
  className,
  inset = 16,
}: {
  children: ReactNode;
  className?: string;
  inset?: number;
}) {
  const rows = Children.toArray(children).filter((child) => isValidElement(child));
  if (rows.length === 0) return null;
  return (
    <View className={`overflow-hidden rounded-3xl bg-card ${className ?? ""}`}>
      {rows.map((row, index) => (
        <Fragment key={(isValidElement(row) && row.key) || index}>
          {index > 0 ? <View className="h-px bg-line" style={{ marginLeft: inset }} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

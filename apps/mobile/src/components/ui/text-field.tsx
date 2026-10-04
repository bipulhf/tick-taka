import { forwardRef } from "react";
import { TextInput, type TextInputProps, View } from "react-native";
import { useColors } from "@/theme/colors";
import { Text } from "./text";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, className, ...props },
  ref,
) {
  const colors = useColors();
  return (
    <View className={`gap-1.5 ${className ?? ""}`}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        className="min-h-12 rounded-2xl border border-line bg-card px-4 font-nunito text-base text-ink"
        {...props}
      />
      {error ? (
        <Text variant="caption" tone="coral">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

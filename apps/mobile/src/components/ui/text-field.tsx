import { forwardRef, useState } from "react";
import { Pressable, TextInput, type TextInputProps, View } from "react-native";
import { useColors } from "@/theme/colors";
import { Icon } from "./icon";
import { Text } from "./text";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
}

/** Labelled input; password fields (secureTextEntry) get a show/hide eye. */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, error, className, secureTextEntry, ...props },
  ref,
) {
  const colors = useColors();
  const [revealed, setRevealed] = useState(false);
  const secret = Boolean(secureTextEntry);
  return (
    <View className={`gap-1.5 ${className ?? ""}`}>
      {label ? (
        <Text variant="label" tone="muted">
          {label}
        </Text>
      ) : null}
      <View className="justify-center">
        <TextInput
          ref={ref}
          placeholderTextColor={colors.muted}
          secureTextEntry={secret && !revealed}
          autoCapitalize={secret ? "none" : props.autoCapitalize}
          autoCorrect={secret ? false : props.autoCorrect}
          className={`min-h-12 rounded-2xl border border-line-strong bg-card px-4 font-nunito text-base text-ink ${secret ? "pr-14" : ""}`}
          {...props}
        />
        {secret ? (
          <Pressable
            onPress={() => setRevealed(!revealed)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={4}
            className="absolute right-1 h-12 w-12 items-center justify-center"
          >
            <Icon name={revealed ? "eye-off-outline" : "eye-outline"} color="muted" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="coral">
          {error}
        </Text>
      ) : null}
    </View>
  );
});

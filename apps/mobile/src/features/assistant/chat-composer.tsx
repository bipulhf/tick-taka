import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, TextInput, View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { useColors } from "@/theme/colors";
import { useVoiceInput } from "./use-voice-input";

function RoundButton({
  icon,
  label,
  onPress,
  variant,
  disabled,
}: {
  icon: "microphone" | "arrow-up" | "check" | "close";
  label: string;
  onPress: () => void;
  variant: "primary" | "plain" | "stop";
  disabled?: boolean;
}) {
  const look = {
    primary: "bg-mango",
    plain: "border border-line bg-card",
    stop: "bg-coral",
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-12 w-12 items-center justify-center rounded-full active:opacity-70 ${look} ${disabled ? "opacity-40" : ""}`}
    >
      <Icon
        name={icon}
        size={24}
        color={variant === "primary" ? "onAccent" : variant === "stop" ? "background" : "ink"}
      />
    </Pressable>
  );
}

/**
 * Type or talk. Speech becomes editable text first, so a misheard word never gets
 * sent, except when the chat was opened to talk (the widget's one tap): then what
 * was heard goes straight to Tiki.
 */
export function ChatComposer({
  onSend,
  busy,
  start,
}: {
  onSend: (text: string) => void;
  busy: boolean;
  start?: "talk";
}) {
  const colors = useColors();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState("");
  const sendHeard = useRef(start === "talk");
  const voice = useVoiceInput((heard) => {
    if (sendHeard.current) {
      sendHeard.current = false;
      onSend(heard);
      return;
    }
    setText((current) => (current.trim() ? `${current.trim()} ${heard}` : heard));
    input.current?.focus();
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on opening; voice.start is new each render.
  useEffect(() => {
    if (start === "talk") void voice.start();
  }, [start]);

  const send = () => {
    if (!text.trim() || busy) return;
    onSend(text);
    setText("");
  };

  if (voice.state !== "idle") {
    const recording = voice.state === "recording";
    return (
      <View className="flex-row items-center gap-3" accessibilityLiveRegion="polite">
        {recording ? (
          <RoundButton
            icon="close"
            label="Cancel recording"
            onPress={voice.cancel}
            variant="plain"
          />
        ) : null}
        <View className="min-h-12 flex-1 flex-row items-center gap-3 rounded-3xl bg-card px-4">
          {recording ? (
            <View className="h-3 w-3 rounded-full bg-coral" />
          ) : (
            <ActivityIndicator color={colors.muted} />
          )}
          <Text variant="callout" tone="muted" numeric>
            {recording
              ? `Listening… ${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, "0")}`
              : "Writing it down…"}
          </Text>
        </View>
        {recording ? (
          <RoundButton icon="check" label="Done talking" onPress={voice.stop} variant="stop" />
        ) : null}
      </View>
    );
  }

  return (
    <View className="flex-row items-end gap-3">
      <TextInput
        ref={input}
        value={text}
        onChangeText={setText}
        placeholder="Message Tiki…"
        placeholderTextColor={colors.muted}
        multiline
        accessibilityLabel="Message"
        className="max-h-32 min-h-12 flex-1 rounded-3xl border border-line-strong bg-card px-4 py-3 font-nunito text-[17px] text-ink"
      />
      {text.trim() ? (
        <RoundButton
          icon="arrow-up"
          label="Send"
          onPress={send}
          variant="primary"
          disabled={busy}
        />
      ) : (
        <RoundButton icon="microphone" label="Talk" onPress={voice.start} variant="plain" />
      )}
    </View>
  );
}

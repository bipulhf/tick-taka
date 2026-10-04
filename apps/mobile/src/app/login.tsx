import { useState } from "react";
import { KeyboardAvoidingView, View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { signIn } from "@/lib/auth";

export default function LoginScreen() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      className="flex-1 justify-end bg-background px-6 pb-12"
    >
      <View className="items-center gap-2 pb-10">
        <Tiki mood={error ? "calm" : "happy"} size={120} />
        <Text variant="display">Tick & Taka</Text>
        <Text tone="muted">Your days and your money, on one screen.</Text>
      </View>
      <View className="gap-4">
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoFocus
          returnKeyType="go"
          onSubmitEditing={submit}
          error={error ?? undefined}
        />
        <Button label="Unlock" onPress={submit} loading={busy} disabled={!password} />
      </View>
    </KeyboardAvoidingView>
  );
}

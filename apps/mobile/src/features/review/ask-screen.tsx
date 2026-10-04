import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { Tiki } from "@/components/tiki/tiki";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { api, unwrap } from "@/lib/api";

const EXAMPLES = [
  "How much did I spend on transport last month?",
  "Which area got the most hours this week?",
  "What's left in my food budget?",
  "How many tasks did I finish this week?",
];

interface Exchange {
  id: number;
  question: string;
  answer: string;
}

/** Plain-language questions answered through fixed, read-only queries on the server. */
export function AskScreen() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Exchange[]>([]);
  const ask = useMutation({
    mutationFn: (q: string) => unwrap(api.ai.ask.$post({ json: { question: q } })),
    onSuccess: (result, q) =>
      setHistory((h) => [{ id: Date.now(), question: q, answer: result.answer }, ...h]),
    onError: (error, q) =>
      setHistory((h) => [{ id: Date.now(), question: q, answer: error.message }, ...h]),
  });
  const submit = (q = question) => {
    if (q.trim().length < 3) return;
    ask.mutate(q.trim());
    setQuestion("");
  };
  return (
    <Screen title="Ask my data" tabBarPadding={false}>
      <View className="flex-row gap-2">
        <TextField
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask about your time or money"
          onSubmitEditing={() => submit()}
          returnKeyType="send"
          className="flex-1"
        />
        <Button
          label="Ask"
          onPress={() => submit()}
          loading={ask.isPending}
          disabled={question.trim().length < 3}
        />
      </View>
      {history.length === 0 ? (
        <View className="gap-2">
          {EXAMPLES.map((example) => (
            <Chip key={example} label={example} onPress={() => submit(example)} />
          ))}
        </View>
      ) : null}
      {history.map((exchange) => (
        <View key={exchange.id} className="gap-2">
          <Text variant="strong" className="self-end rounded-2xl bg-mango/30 px-4 py-2">
            {exchange.question}
          </Text>
          <Card className="flex-row gap-3">
            <Tiki mood="happy" size={36} />
            <Text className="flex-1">{exchange.answer}</Text>
          </Card>
        </View>
      ))}
    </Screen>
  );
}

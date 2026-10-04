import type { QuickAddKind } from "@tick-taka/shared/quick-add";
import { useLocalSearchParams } from "expo-router";
import { QuickAddSheet } from "@/features/quick-add/quick-add-sheet";

const KINDS: QuickAddKind[] = ["task", "expense", "income", "time_entry"];

export default function QuickAddRoute() {
  const params = useLocalSearchParams<{ text?: string; kind?: string; smsFingerprint?: string }>();
  const kind = KINDS.find((k) => k === params.kind) ?? null;
  return (
    <QuickAddSheet
      initialText={params.text ?? ""}
      initialKind={kind}
      smsFingerprint={params.smsFingerprint}
    />
  );
}

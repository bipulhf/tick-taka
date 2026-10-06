import { View } from "react-native";
import {
  useIsOnline,
  usePendingWrites,
  useSavedQueueUnreadable,
  useStuckWrites,
  useSyncStalled,
} from "@/lib/connection";
import { plural } from "@/lib/format";
import { outbox } from "@/lib/outbox";
import type { OutboxEntry } from "@/lib/outbox-policy";
import { Button } from "./button";
import { Icon } from "./icon";
import { Text } from "./text";

/** What a stuck write was, in words: its label, or the kind of change. */
function describeWrite(entry: OutboxEntry): string {
  if (entry.request.label) return entry.request.label;
  const verb = { POST: "Add", PATCH: "Edit", PUT: "Update", DELETE: "Delete" }[
    entry.request.method
  ];
  const what = entry.request.path.split("/")[1]?.replaceAll("-", " ") ?? "item";
  return `${verb} in ${what}`;
}

/** Changes the server kept failing on, each with Retry and Discard. */
function StuckWrites({ entries }: { entries: readonly OutboxEntry[] }) {
  return (
    <View accessibilityRole="alert" className="gap-3 rounded-3xl bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="alert-circle-outline" size={18} color="coral" />
        <Text variant="callout" className="flex-1">
          {`${plural(entries.length, "change")} couldn't be saved on the server`}
        </Text>
      </View>
      {entries.map((entry) => (
        <View key={entry.id} className="gap-2">
          <Text variant="caption" tone="muted">
            {describeWrite(entry)}
          </Text>
          <View className="flex-row gap-2">
            <Button
              label="Retry"
              size="sm"
              variant="secondary"
              onPress={() => outbox.retryStuck(entry.id)}
            />
            <Button
              label="Discard"
              size="sm"
              variant="ghost"
              onPress={() => outbox.discardStuck(entry.id)}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * A quiet line at the top of each screen while offline, so nothing looks broken:
 * what you see may be from earlier, and your changes are kept and will sync. Online,
 * it appears only when changes aren't getting through, and lists any the server
 * kept failing on so they can be retried or discarded.
 */
export function SyncStatus() {
  const online = useIsOnline();
  const pending = usePendingWrites();
  const stuck = useStuckWrites();
  const stalled = useSyncStalled();
  const unreadable = useSavedQueueUnreadable();
  const waiting = pending - stuck.length;
  let line: string | null = null;
  if (unreadable) line = "Changes saved on this phone can't be read right now · trying again";
  else if (!online)
    line =
      waiting > 0
        ? `Offline · ${plural(waiting, "change")} will sync when you're back`
        : "Offline · showing what was saved earlier";
  else if (stalled && waiting > 0)
    line = `${plural(waiting, "change")} waiting · the server isn't answering yet`;
  if (!line && stuck.length === 0) return null;
  return (
    <View className="gap-2">
      {line ? (
        <View
          accessibilityRole="alert"
          className="flex-row items-center gap-2 self-start rounded-full bg-card px-3 py-2"
        >
          <Icon
            name={online ? "cloud-sync-outline" : "cloud-off-outline"}
            size={18}
            color="muted"
          />
          <Text variant="caption" tone="muted">
            {line}
          </Text>
        </View>
      ) : null}
      {stuck.length > 0 ? <StuckWrites entries={stuck} /> : null}
    </View>
  );
}

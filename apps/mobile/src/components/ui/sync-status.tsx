import { View } from "react-native";
import {
  useIsOnline,
  usePendingWrites,
  useQueueNotSaved,
  useSavedQueueUnreadable,
  useStuckWrites,
  useSyncStalled,
} from "@/lib/connection";
import { plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { outbox } from "@/lib/outbox";
import type { OutboxEntry } from "@/lib/outbox-policy";
import { describeDiscard, describeGroup } from "@/lib/stuck-copy";
import { Button } from "./button";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * Stuck writes by group: the write the server kept failing on, then the later writes
 * that can't go ahead of it, set aside with it.
 */
function groupStuck(entries: readonly OutboxEntry[]): OutboxEntry[][] {
  const groups = new Map<string, OutboxEntry[]>();
  for (const entry of entries) {
    const key = entry.stuckWith ?? entry.id;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }
  return [...groups.values()];
}

/** Changes the server kept failing on, each group with Retry and Discard. */
function StuckWrites({ entries }: { entries: readonly OutboxEntry[] }) {
  const groups = groupStuck(entries);
  return (
    <View accessibilityRole="alert" className="gap-3 rounded-3xl bg-card p-4">
      <View className="flex-row items-center gap-2">
        <Icon name="alert-circle-outline" size={18} color="coral" />
        <Text variant="callout" className="flex-1">
          {`${plural(groups.length, "change")} couldn't be saved on the server`}
        </Text>
      </View>
      {groups.map((group) => {
        const head = group[0];
        return head ? (
          <View key={head.id} className="gap-2">
            <Text variant="caption" tone="muted">
              {describeGroup(group)}
            </Text>
            {/* Apart, so a tap meant for Retry doesn't land on Discard. */}
            <View className="flex-row gap-6">
              <Button
                label="Retry"
                size="sm"
                variant="secondary"
                onPress={() => outbox.retryStuck(head.id)}
              />
              <Button
                label="Discard"
                size="sm"
                variant="ghost"
                onPress={() => {
                  // Undo instead of "Are you sure?", as everywhere else in the app.
                  const dropped = outbox.discardStuck(head.id);
                  notify(describeDiscard(dropped), {
                    label: "Undo",
                    onPress: () => outbox.restoreStuck(dropped),
                  });
                }}
              />
            </View>
          </View>
        ) : null;
      })}
      {groups.length > 1 ? (
        <Button
          label="Retry all"
          size="sm"
          variant="secondary"
          onPress={() => outbox.retryAllStuck()}
        />
      ) : null}
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
  const notSaved = useQueueNotSaved();
  const waiting = pending - stuck.length;
  let line: string | null = null;
  if (notSaved && waiting > 0)
    line = `${plural(waiting, "change")} not saved on this phone yet · keep the app open until they sync`;
  else if (unreadable) line = "Changes saved on this phone can't be read right now · trying again";
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

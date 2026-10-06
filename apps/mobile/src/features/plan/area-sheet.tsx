import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, useColorScheme, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useOutbox } from "@/lib/outbox";
import { useAreas } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { AREA_COLORS, AREA_SWATCHES, areaColorValue } from "./area-colors";

type Area = NonNullable<ReturnType<typeof useAreas>["data"]>[number];

const EMOJIS = ["💼", "🏠", "💪", "📚", "💰", "❤️", "🧘", "🎨", "👨‍👩‍👧", "🕌", "✈️", "⭐"];

/** Add or edit an area of life: its emoji, name and colour, in one small sheet. */
export function AreaSheet({ id }: { id: string | null }) {
  const areas = useAreas();
  const area = id ? areas.data?.find((a) => a.id === id) : undefined;
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id && !area)
    return (
      <Sheet title="Area">
        {areas.isError ? (
          <ErrorState onRetry={() => void areas.refetch()} />
        ) : (
          <SkeletonForm fields={3} />
        )}
      </Sheet>
    );
  return <AreaForm area={area} count={areas.data?.length ?? 0} />;
}

function AreaForm({ area, count }: { area: Area | undefined; count: number }) {
  const router = useRouter();
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  const send = useOutbox();
  const remove = useRemove();
  const [name, setName] = useState(area?.name ?? "");
  const [emoji, setEmoji] = useState(area?.emoji ?? "⭐");
  const [color, setColor] = useState(area?.color ?? AREA_COLORS[count % AREA_COLORS.length]!);
  const save = () => {
    if (!name.trim() || !emoji.trim()) return;
    const body = { name: name.trim(), emoji: emoji.trim(), color };
    if (area)
      send({
        method: "PATCH",
        path: `/areas/${area.id}`,
        body: { ...body, updatedAt: editTime() },
        label: "Couldn't save",
      });
    else
      send({
        method: "POST",
        path: "/areas",
        body: { id: newId(), ...body, sort: count },
        label: "Couldn't save",
      });
    router.back();
  };
  return (
    <Sheet
      title={area ? area.name : "New area"}
      footer={
        <View className="flex-row gap-2">
          {area ? (
            <DeleteButton
              onPress={() => {
                remove(`/areas/${area.id}`, `“${area.name}”`);
                router.back();
              }}
            />
          ) : null}
          <Button
            label={area ? "Save" : "Add area"}
            onPress={save}
            disabled={!name.trim() || !emoji.trim()}
            className="flex-1"
          />
        </View>
      }
    >
      <View className="flex-row gap-2">
        <TextField
          value={emoji}
          onChangeText={setEmoji}
          accessibilityLabel="Emoji"
          className="w-16"
        />
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="Work, Home, Health…"
          accessibilityLabel="Area name"
          autoFocus={!area}
          className="flex-1"
        />
      </View>
      <View className="flex-row flex-wrap gap-2">
        {EMOJIS.map((e) => (
          <Chip key={e} label={e} selected={emoji === e} onPress={() => setEmoji(e)} />
        ))}
      </View>
      <Text variant="label" tone="muted">
        Colour
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Colour"
        className="flex-row flex-wrap gap-3"
      >
        {AREA_SWATCHES.map(({ hex, name }) => (
          <Pressable
            key={hex}
            onPress={() => setColor(hex)}
            accessibilityRole="radio"
            accessibilityState={{ checked: color === hex }}
            accessibilityLabel={name}
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: areaColorValue(hex, scheme) }}
          >
            {color === hex ? <Icon name="check" color="onAccent" size={22} /> : null}
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

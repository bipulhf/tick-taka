import { parseAmountToMinor, toMajor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useOutbox } from "@/lib/outbox";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { useShopping, useShoppingLists } from "./queries";

type Item = NonNullable<ReturnType<typeof useShopping>["data"]>[number];

/**
 * Edits one shopping item. `list` is the list it was opened from, so the item
 * comes straight from that list's cached query.
 */
export function ShoppingItemSheet({ id, list }: { id: string; list?: string | undefined }) {
  const { data: items } = useShopping(list);
  const item = items?.find((i) => i.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (!item)
    return (
      <Sheet title="Item">
        <SkeletonForm fields={3} />
      </Sheet>
    );
  return <ShoppingItemForm item={item} />;
}

function ShoppingItemForm({ item }: { item: Item }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const lists = useShoppingLists();
  const [title, setTitle] = useState(item.title);
  const [price, setPrice] = useState(item.estMinor ? String(toMajor(item.estMinor)) : "");
  const [listName, setListName] = useState(item.listName);
  const names = [
    ...new Set(["Bazar", item.listName, ...(lists.data ?? []).map((l) => l.listName)]),
  ];
  const save = () => {
    if (!title.trim() || !listName.trim()) return;
    send({
      method: "PATCH",
      path: `/shopping/${item.id}`,
      body: {
        title: title.trim(),
        estMinor: parseAmountToMinor(price || "0") || null,
        listName: listName.trim(),
        updatedAt: editTime(),
      },
      label: "Couldn't save",
    });
    router.back();
  };
  return (
    <Sheet
      title={item.title}
      footer={
        <View className="flex-row gap-2">
          <DeleteButton
            onPress={() => {
              remove(`/shopping/${item.id}`, `“${item.title}”`);
              router.back();
            }}
          />
          <Button
            label="Save"
            onPress={save}
            disabled={!title.trim() || !listName.trim()}
            className="flex-1"
          />
        </View>
      }
    >
      <TextField label="Item" value={title} onChangeText={setTitle} placeholder="Rice 5kg" />
      <TextField
        label="Estimate (optional)"
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
        placeholder="৳"
      />
      <TextField label="List" value={listName} onChangeText={setListName} placeholder="Bazar" />
      <View className="flex-row flex-wrap gap-2">
        {names.map((name) => (
          <Chip
            key={name}
            label={name}
            tone="mint"
            choice="single"
            selected={listName.trim() === name}
            onPress={() => setListName(name)}
          />
        ))}
      </View>
    </Sheet>
  );
}

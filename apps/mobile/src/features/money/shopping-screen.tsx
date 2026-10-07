import { newId } from "@tick-taka/shared/ids";
import { parseAmountToMinor } from "@tick-taka/shared/money";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Amount } from "@/components/ui/amount";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Screen } from "@/components/ui/screen";
import { SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow, SwipeRowPressable } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { formatAmount, plural } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useAccounts, useCategories } from "@/lib/queries";
import { useRemove } from "@/lib/use-remove";
import { useShopping, useShoppingLists } from "./queries";

/** Priced shopping list: tick items at checkout and the list becomes one expense. */
export function ShoppingScreen() {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const lists = useShoppingLists();
  const [listName, setListName] = useState("Bazar");
  const items = useShopping(listName);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [paid, setPaid] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [newList, setNewList] = useState("");
  const list = items.data ?? [];
  const checked = list.filter((i) => i.checkedAt);
  const estimate = list.reduce((sum, i) => sum + (i.estMinor ?? 0), 0);
  const checkedTotal = checked.reduce((sum, i) => sum + (i.estMinor ?? 0), 0);
  const groceries = categories.find((c) => c.name === "Groceries")?.id ?? null;

  const add = () => {
    if (!title.trim()) return;
    send({
      method: "POST",
      path: "/shopping",
      body: {
        id: newId(),
        listName,
        title: title.trim(),
        estMinor: parseAmountToMinor(price || "0") || null,
      },
    });
    setTitle("");
    setPrice("");
  };
  const checkout = () => {
    const account = accountId ?? accounts[0]?.id;
    if (!account) return notify("Add an account first");
    const amountMinor = paid ? parseAmountToMinor(paid) : undefined;
    send({
      method: "POST",
      path: "/shopping/checkout",
      body: {
        transactionId: newId(),
        listName,
        accountId: account,
        categoryId: groceries,
        ...(amountMinor ? { amountMinor } : {}),
      },
      label: "Couldn't check out",
    });
    notify(`Logged ${formatAmount(amountMinor ?? checkedTotal)} for ${listName}`);
    setPaid("");
  };
  const addList = () => {
    if (!newList.trim()) return;
    setListName(newList.trim());
    setNewList("");
  };
  const names = [...new Set(["Bazar", ...(lists.data ?? []).map((l) => l.listName)])];

  return (
    <Screen title="Shopping" subtitle={`Estimated ${formatAmount(estimate)}`} tabBarPadding={false}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="List"
        className="flex-row flex-wrap gap-2"
      >
        {names.map((name) => (
          <Chip
            key={name}
            label={name}
            tone="mint"
            choice="single"
            selected={listName === name}
            onPress={() => setListName(name)}
          />
        ))}
        <TextField
          value={newList}
          onChangeText={setNewList}
          placeholder="+ list"
          accessibilityLabel="New list name"
          onSubmitEditing={addList}
          className="w-28"
        />
      </View>
      <View className="flex-row gap-2">
        <TextField
          value={title}
          onChangeText={setTitle}
          placeholder="Rice 5kg"
          accessibilityLabel="Item"
          className="flex-1"
          onSubmitEditing={add}
        />
        <TextField
          value={price}
          onChangeText={setPrice}
          placeholder="৳"
          accessibilityLabel="Estimated price"
          keyboardType="decimal-pad"
          className="w-24"
          onSubmitEditing={add}
        />
      </View>
      <AsyncContent
        query={items}
        skeleton={<SkeletonList rows={4} leading="none" trailing />}
        isEmpty={() => list.length === 0}
        empty={
          <EmptyState
            title="Nothing on this list yet"
            message="List the bazar before you go, then tick items off at checkout."
          />
        }
      >
        {() => (
          <Card className="py-1">
            {list.map((item) => {
              const edit = () =>
                router.push(`/shopping-item/${item.id}?list=${encodeURIComponent(listName)}`);
              const drop = () => remove(`/shopping/${item.id}`, `“${item.title}”`);
              return (
                <SwipeRow key={item.id} rounded={false} actions={editDelete(edit, drop)}>
                  <View className="flex-row items-center bg-card">
                    <Checkbox
                      tone="mint"
                      checked={Boolean(item.checkedAt)}
                      label={item.title}
                      onChange={(on) =>
                        send({
                          method: "PATCH",
                          path: `/shopping/${item.id}`,
                          body: { checked: on },
                        })
                      }
                    />
                    <SwipeRowPressable
                      onPress={edit}
                      className="min-h-12 flex-1 flex-row items-center gap-2 active:opacity-80"
                      accessibilityHint="Opens the item. Delete is in the actions menu"
                    >
                      <Text className={`flex-1 ${item.checkedAt ? "text-muted line-through" : ""}`}>
                        {item.title}
                      </Text>
                      {item.estMinor ? (
                        <Amount
                          minor={item.estMinor}
                          variant="caption"
                          tone="muted"
                          animate={false}
                        />
                      ) : null}
                    </SwipeRowPressable>
                    <IconButton
                      icon="close"
                      label={`Remove ${item.title}`}
                      color="muted"
                      iconSize={18}
                      onPress={drop}
                    />
                  </View>
                </SwipeRow>
              );
            })}
          </Card>
        )}
      </AsyncContent>
      {checked.length > 0 ? (
        <Card className="gap-2">
          <Text variant="strong">
            Checkout · {plural(checked.length, "item")} · est. {formatAmount(checkedTotal)}
          </Text>
          <TextField
            value={paid}
            onChangeText={setPaid}
            keyboardType="decimal-pad"
            placeholder={`Paid (default ${formatAmount(checkedTotal)})`}
          />
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Paid from"
            className="flex-row flex-wrap gap-2"
          >
            {accounts.map((a) => (
              <Chip
                key={a.id}
                label={a.name}
                tone="mint"
                choice="single"
                selected={(accountId ?? accounts[0]?.id) === a.id}
                onPress={() => setAccountId(a.id)}
              />
            ))}
          </View>
          <Button label="Log as one expense" onPress={checkout} />
        </Card>
      ) : null}
    </Screen>
  );
}

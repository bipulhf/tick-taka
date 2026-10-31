import { useNavigate } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows, ViewSkeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { useOpenPanel } from "@/lib/panel";
import { useSettings } from "@/lib/queries";
import { fire, remove } from "@/lib/write";
import { AmountField } from "./amount-field";
import { readAmount } from "./amount-text";
import { type ShoppingItem, useShopping, useShoppingLists } from "./queries";
import { ShoppingCheckout } from "./shopping-checkout";
import { listNames, shoppingTotals } from "./shopping-totals";

function ItemRow({ item, listName }: { item: ShoppingItem; listName: string }) {
  const open = useOpenPanel();
  const checked = Boolean(item.checkedAt);
  const toggle = (on: boolean) =>
    fire({ method: "PATCH", path: `/shopping/${item.id}`, body: { checked: on } });
  const drop = () => void remove(`/shopping/${item.id}`, `“${item.title}”`).catch(() => {});
  return (
    <Row
      dataKey={`shopping-item:${item.id}`}
      keyActions={{ toggle: () => toggle(!checked), remove: drop }}
      onClick={() => open(`shopping-item:${item.id}`, { list: listName })}
      leading={<Checkbox tone="mint" checked={checked} label={item.title} onChange={toggle} />}
      title={item.title}
      muted={checked}
      trailing={
        <>
          {item.estMinor ? (
            <Amount minor={item.estMinor} animate={false} className="text-callout text-muted" />
          ) : null}
          <IconButton icon={X} size="sm" label={`Remove ${item.title}`} onClick={drop} />
        </>
      }
    />
  );
}

/** Priced shopping list: tick items at checkout and the list becomes one expense. */
export function ShoppingView() {
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const lists = useShoppingLists();
  const [listName, setListName] = useState("Bazar");
  const items = useShopping(listName);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [newList, setNewList] = useState("");
  const list = items.data ?? [];
  const totals = shoppingTotals(list);
  const names = listNames(lists.data ?? [], listName);

  const add = () => {
    if (!title.trim()) return;
    fire({
      method: "POST",
      path: "/shopping",
      body: {
        id: newId(),
        listName,
        title: title.trim(),
        estMinor: readAmount(price || "0") || null,
      },
      label: "Couldn't add the item",
    });
    setTitle("");
    setPrice("");
  };
  const addList = () => {
    if (!newList.trim()) return;
    setListName(newList.trim());
    setNewList("");
  };

  if (!settings) return <ViewSkeleton />;
  if (!settings.advancedViews.shoppingList)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Shopping" back={{ to: "/money", label: "Money" }} />
        <EmptyState
          title="Shopping list is off"
          message="Turn on Shopping list in Settings › Your day › More options."
          actionLabel="Open Settings"
          onAction={() => void navigate({ to: "/settings", search: { section: "day" } })}
        />
      </div>
    );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Shopping"
        back={{ to: "/money", label: "Money" }}
        subtitle={
          <>
            Estimated <Amount minor={totals.estimateMinor} animate={false} />
          </>
        }
      />
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">List</legend>
              {names.map((name) => (
                <Chip key={name} selected={listName === name} onClick={() => setListName(name)}>
                  {name}
                </Chip>
              ))}
            </fieldset>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                addList();
              }}
            >
              <TextField
                aria-label="New list name"
                value={newList}
                onChange={(e) => setNewList(e.target.value)}
                placeholder="+ list"
                className="w-28 [&_input]:h-8 [&_input]:text-callout"
              />
            </form>
          </div>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              add();
            }}
          >
            <TextField
              aria-label="Item"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Rice 5kg"
              className="basis-full sm:flex-1 sm:basis-auto"
            />
            <AmountField
              aria-label="Estimated price"
              value={price}
              onChange={setPrice}
              placeholder="0"
              className="flex-1 sm:w-28 sm:flex-none"
            />
            <Button type="submit" icon={Plus} disabled={!title.trim()}>
              Add
            </Button>
          </form>
          {items.data === undefined ? (
            items.isError ? (
              <ErrorState onRetry={() => void items.refetch()} />
            ) : (
              <SkeletonRows rows={4} />
            )
          ) : list.length === 0 ? (
            <EmptyState
              title="Nothing on this list yet"
              message="List the bazar before you go, then tick items off at checkout."
            />
          ) : (
            <Group label={listName}>
              {list.map((item) => (
                <ItemRow key={item.id} item={item} listName={listName} />
              ))}
            </Group>
          )}
        </div>
        {totals.checkedCount > 0 ? (
          <div className="lg:sticky lg:top-4">
            <ShoppingCheckout
              listName={listName}
              checkedCount={totals.checkedCount}
              checkedMinor={totals.checkedMinor}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

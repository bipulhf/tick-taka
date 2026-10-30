import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { TextField } from "@/components/ui/text-field";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { AmountField } from "./amount-field";
import { amountText, readAmount } from "./amount-text";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import { type ShoppingItem, useShopping, useShoppingLists } from "./queries";
import { listNames } from "./shopping-totals";

/**
 * Edits one shopping item. The preset's `list` is the list it was opened from, so the
 * item comes straight from that list's cached query.
 */
export function ShoppingItemPanel({ id, onClose, preset }: PanelComponentProps) {
  const { data: items } = useShopping(preset.get("list") ?? undefined);
  const item = items?.find((i) => i.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (!item)
    return (
      <Panel open onClose={onClose} title="Item">
        <PanelSkeleton fields={3} />
      </Panel>
    );
  return <ShoppingItemForm item={item} onClose={onClose} />;
}

function ShoppingItemForm({ item, onClose }: { item: ShoppingItem; onClose: () => void }) {
  const lists = useShoppingLists();
  const initial = { title: item.title, price: amountText(item.estMinor), listName: item.listName };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof initial>) => setForm((f) => ({ ...f, ...patch }));
  const names = listNames(lists.data ?? [], item.listName);
  const valid = Boolean(form.title.trim() && form.listName.trim());
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await write({
        method: "PATCH",
        path: `/shopping/${item.id}`,
        body: {
          title: form.title.trim(),
          estMinor: readAmount(form.price || "0") || null,
          listName: form.listName.trim(),
        },
        label: "Couldn't save",
      });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={item.title}
      dirty={dirty}
      footer={
        <>
          <DeleteButton
            onClick={() => {
              onClose();
              void remove(`/shopping/${item.id}`, `“${item.title}”`).catch(() => {});
            }}
          />
          <Button
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!valid}
            onClick={() => void save()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Item"
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Rice 5kg"
        />
        <AmountField
          label="Estimate (optional)"
          value={form.price}
          onChange={(price) => set({ price })}
        />
        <TextField
          label="List"
          value={form.listName}
          onChange={(e) => set({ listName: e.target.value })}
          placeholder="Bazar"
        />
        <fieldset className="-mt-2 flex flex-wrap gap-2">
          <legend className="sr-only">Lists</legend>
          {names.map((name) => (
            <Chip
              key={name}
              selected={form.listName.trim() === name}
              onClick={() => set({ listName: name })}
            >
              {name}
            </Chip>
          ))}
        </fieldset>
        <button type="submit" hidden />
      </form>
    </Panel>
  );
}

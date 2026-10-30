/** Pure rules behind the shopping list. */

interface ItemLike {
  estMinor: number | null;
  checkedAt: number | null;
}

export interface ShoppingTotals {
  /** Every item's estimate on the list. */
  estimateMinor: number;
  checkedCount: number;
  /** The ticked items' estimates: what checkout logs unless a paid amount is typed. */
  checkedMinor: number;
}

export function shoppingTotals(items: ItemLike[]): ShoppingTotals {
  const checked = items.filter((i) => i.checkedAt);
  return {
    estimateMinor: items.reduce((sum, i) => sum + (i.estMinor ?? 0), 0),
    checkedCount: checked.length,
    checkedMinor: checked.reduce((sum, i) => sum + (i.estMinor ?? 0), 0),
  };
}

/** The lists to choose from: Bazar first, then the current one, then every saved list. */
export function listNames(lists: { listName: string }[], current?: string): string[] {
  return [...new Set(["Bazar", ...(current ? [current] : []), ...lists.map((l) => l.listName)])];
}

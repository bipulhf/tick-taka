import { useEffect } from "react";

/**
 * Keyboard work on lists: J / K move between rows, Enter opens, X completes, T
 * toggles top three, Delete removes. A row is any element with `data-row="<key>"`
 * (the Row component sets it from `dataKey`); the row with focus is the current one,
 * so screen readers and the focus ring follow along for free.
 */
export interface RowKeyActions {
  toggle?: () => void;
  star?: () => void;
  remove?: () => void;
}

const registry = new Map<string, RowKeyActions>();

/** Gives a row its X / T / Delete actions while it is on screen. */
export function useRowKeyActions(key: string | undefined, actions: RowKeyActions | undefined) {
  useEffect(() => {
    if (!key || !actions) return;
    registry.set(key, actions);
    return () => {
      if (registry.get(key) === actions) registry.delete(key);
    };
  });
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>("#main [data-row]")].filter(
    (row) => row.offsetParent !== null,
  );
}

function focusRow(row: HTMLElement | undefined) {
  if (!row) return;
  const target = row.querySelector<HTMLElement>("[data-row-primary]") ?? row;
  target.focus();
  row.scrollIntoView({ block: "nearest" });
}

/** Handles one list key; true when it did something (the caller prevents the default). */
export function handleRowKey(event: KeyboardEvent): boolean {
  const current = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>(
    "#main [data-row]",
  );
  const key = event.key;
  if (key === "j" || key === "k" || key === "ArrowDown" || key === "ArrowUp") {
    // Arrows only move once a row has focus, so they still scroll the page otherwise.
    if (!current && key.startsWith("Arrow")) return false;
    const list = rows();
    if (list.length === 0) return false;
    const index = current ? list.indexOf(current) : -1;
    const down = key === "j" || key === "ArrowDown";
    focusRow(
      list[index === -1 ? 0 : Math.max(0, Math.min(list.length - 1, index + (down ? 1 : -1)))],
    );
    return true;
  }
  if (!current) return false;
  const actions = registry.get(current.dataset.row ?? "");
  if (!actions) return false;
  if (key === "x" && actions.toggle) actions.toggle();
  else if (key === "t" && actions.star) actions.star();
  else if ((key === "Delete" || key === "Backspace") && actions.remove) {
    // Keep the place in the list: focus the neighbour before the row goes.
    const list = rows();
    const index = list.indexOf(current);
    focusRow(list[index + 1] ?? list[index - 1]);
    actions.remove();
  } else return false;
  return true;
}

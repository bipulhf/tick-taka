import { useNavigate } from "@tanstack/react-router";
import { Command, defaultFilter } from "cmdk";
import { Eye, Keyboard, Moon, Settings, Sun } from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { togglePrivacy } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { toggleTheme, useTheme } from "@/lib/theme";
import { paletteOpenStore, shortcutsOpenStore } from "@/lib/ui-state";
import { NAV } from "./nav";

export interface PaletteAction {
  id: string;
  label: string;
  group: string;
  icon?: ReactNode;
  keywords?: string[];
  run: () => void;
}

/** Actions other parts of the app add to the palette (new expense, start focus…). */
const extraActions = new Set<() => PaletteAction[]>();
export function registerPaletteActions(source: () => PaletteAction[]): () => void {
  extraActions.add(source);
  return () => extraActions.delete(source);
}

/** Extra result groups (search hits) that depend on what was typed. */
export type PaletteSearch = (query: string, close: () => void) => ReactNode;
const searches = new Set<PaletteSearch>();
export function registerPaletteSearch(search: PaletteSearch): () => void {
  searches.add(search);
  return () => searches.delete(search);
}

/** Results offered for anything typed, below every other group ("Ask Tiki: …"). */
const fallbacks = new Set<PaletteSearch>();
export function registerPaletteFallback(search: PaletteSearch): () => void {
  fallbacks.add(search);
  return () => fallbacks.delete(search);
}

/**
 * Items whose value starts with this always match whatever is typed and rank below
 * every real match (fallbacks, e.g. "Ask Tiki: …"), so Enter still picks a real one first.
 */
export const PALETTE_FALLBACK = "fallback:";

const paletteFilter = (value: string, search: string, keywords?: string[]) =>
  value.startsWith(PALETTE_FALLBACK) ? 0.001 : defaultFilter(value, search, keywords);

const itemClass =
  "flex min-h-10 cursor-pointer items-center gap-3 rounded-xl px-3 text-body outline-none select-none data-[selected=true]:bg-line/60";

export const paletteItemClass = itemClass;

/** Ctrl/⌘ K: go anywhere, run an action, or search tasks and transactions. */
export function CommandPalette() {
  const open = useStore(paletteOpenStore);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const list = useRef<HTMLDivElement>(null);
  // Search hits arrive after typing; cmdk only picks the first item when it filters, so
  // without this Enter would do nothing until ↓. Keep the selection on a real item.
  useEffect(() => {
    const element = list.current;
    if (!open || !element) return;
    const pickFirst = () => {
      const items = [...element.querySelectorAll<HTMLElement>("[cmdk-item]")];
      if (items.some((item) => item.dataset.value === selected)) return;
      const first = items[0]?.dataset.value;
      if (first) setSelected(first);
    };
    pickFirst();
    const observer = new MutationObserver(pickFirst);
    observer.observe(element, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [open, selected]);
  const theme = useTheme();
  const close = () => {
    paletteOpenStore.set(false);
    setQuery("");
  };
  const go = (to: string) => {
    close();
    void navigate({ to });
  };
  const actions: PaletteAction[] = [
    ...[...extraActions].flatMap((source) => source()),
    {
      id: "privacy",
      label: "Hide or show amounts",
      group: "Actions",
      icon: <Eye aria-hidden className="size-4 text-muted" />,
      run: togglePrivacy,
    },
    {
      id: "theme",
      label: theme === "dark" ? "Use light theme" : "Use dark theme",
      group: "Actions",
      icon:
        theme === "dark" ? (
          <Sun aria-hidden className="size-4 text-muted" />
        ) : (
          <Moon aria-hidden className="size-4 text-muted" />
        ),
      run: toggleTheme,
    },
    {
      id: "shortcuts",
      label: "Keyboard shortcuts",
      group: "Actions",
      icon: <Keyboard aria-hidden className="size-4 text-muted" />,
      run: () => shortcutsOpenStore.set(true),
    },
  ];
  const groups = [...new Set(actions.map((a) => a.group))];

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? paletteOpenStore.set(true) : close())}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/25" />
        <Dialog.Content className="fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 animate-fade-in overflow-hidden rounded-3xl border border-line bg-card shadow-2xl shadow-ink/20">
          <Dialog.Title className="sr-only">Go to or search</Dialog.Title>
          <Dialog.Description className="sr-only">
            Type to find a view, an action, a task or a transaction.
          </Dialog.Description>
          <Command
            label="Go to or search"
            loop
            shouldFilter
            filter={paletteFilter}
            value={selected}
            onValueChange={setSelected}
          >
            <Command.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Go to, do, or search…"
              className="h-14 w-full border-b border-line bg-transparent px-5 text-heading font-semibold outline-none placeholder:font-normal placeholder:text-muted"
            />
            <Command.List ref={list} className="max-h-[min(460px,60vh)] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-6 text-center text-callout text-muted">
                Nothing matches. Try another word.
              </Command.Empty>
              {query.trim().length >= 2
                ? [...searches].map((search, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: registered searches keep their order
                    <div key={i}>{search(query.trim(), close)}</div>
                  ))
                : null}
              {groups.map((group) => (
                <Command.Group
                  key={group}
                  heading={group}
                  className="px-1 py-1 text-caption text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                >
                  {actions
                    .filter((a) => a.group === group)
                    .map((action) => (
                      <Command.Item
                        key={action.id}
                        value={`${action.label} ${action.keywords?.join(" ") ?? ""}`}
                        onSelect={() => {
                          close();
                          action.run();
                        }}
                        className={itemClass}
                      >
                        {action.icon}
                        <span className="font-semibold text-ink">{action.label}</span>
                      </Command.Item>
                    ))}
                </Command.Group>
              ))}
              <Command.Group
                heading="Go to"
                className="px-1 py-1 text-caption text-muted [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {NAV.flatMap((section) => [
                  { ...section, parent: "" },
                  ...section.children
                    .filter((c) => c.to !== section.to)
                    .map((c) => ({ ...c, parent: section.label })),
                ]).map((link) => (
                  <Command.Item
                    key={link.to}
                    value={`${link.parent} ${link.label}`}
                    onSelect={() => go(link.to)}
                    className={itemClass}
                  >
                    <link.icon aria-hidden className="size-4 text-muted" />
                    <span className="font-semibold text-ink">{link.label}</span>
                    {link.parent ? (
                      <span className="text-caption font-normal text-muted">{link.parent}</span>
                    ) : null}
                  </Command.Item>
                ))}
                <Command.Item
                  value="Settings preferences"
                  onSelect={() => go("/settings")}
                  className={itemClass}
                >
                  <Settings aria-hidden className="size-4 text-muted" />
                  <span className="font-semibold text-ink">Settings</span>
                </Command.Item>
              </Command.Group>
              {query.trim().length >= 2
                ? [...fallbacks].map((search, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: registered fallbacks keep their order
                    <div key={i}>{search(query.trim(), close)}</div>
                  ))
                : null}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

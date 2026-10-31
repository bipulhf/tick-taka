import { useNavigate } from "@tanstack/react-router";
import { Dialog } from "radix-ui";
import { useEffect } from "react";
import { Kbd } from "@/components/ui/kbd";
import { togglePrivacy } from "@/lib/prefs";
import { handleRowKey } from "@/lib/row-keys";
import { useStore } from "@/lib/store";
import { toggleTheme } from "@/lib/theme";
import {
  assistantOpenStore,
  focusQuickAdd,
  isTypingTarget,
  paletteOpenStore,
  shortcutsOpenStore,
} from "@/lib/ui-state";
import { NAV } from "./nav";

/** G then a letter jumps to a view; the letters come from nav.ts. */
const JUMPS: Record<string, string> = Object.fromEntries([
  ...NAV.flatMap((section) => [
    ...(section.key ? [[section.key, section.to]] : []),
    ...section.children.flatMap((c) => (c.key ? [[c.key, c.to]] : [])),
  ]),
  [",", "/settings"],
]);

/** Shortcuts that work anywhere outside a text field. Lists add their own (J, K, X…). */
export function useGlobalShortcuts() {
  const navigate = useNavigate();
  useEffect(() => {
    let awaitingJump = 0;
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "k") {
        event.preventDefault();
        paletteOpenStore.set(!paletteOpenStore.get());
        return;
      }
      if (mod && event.key.toLowerCase() === "j") {
        event.preventDefault();
        assistantOpenStore.set(!assistantOpenStore.get());
        return;
      }
      if (mod || event.altKey || isTypingTarget(event.target) || event.defaultPrevented) return;
      // Inside a dialog or panel, single letters belong to it.
      if ((event.target as HTMLElement | null)?.closest?.("[role=dialog]")) return;
      const key = event.key;
      if (Date.now() < awaitingJump) {
        awaitingJump = 0;
        const to = JUMPS[key.toLowerCase()];
        if (to) {
          event.preventDefault();
          void navigate({ to });
        }
        return;
      }
      if (key === "g" || key === "G") {
        awaitingJump = Date.now() + 1200;
        return;
      }
      if (handleRowKey(event)) {
        event.preventDefault();
        return;
      }
      if (key === "n" || key === "/") {
        event.preventDefault();
        focusQuickAdd();
      } else if (key === "?") {
        event.preventDefault();
        shortcutsOpenStore.set(true);
      } else if (key === "H" && event.shiftKey) {
        event.preventDefault();
        togglePrivacy();
      } else if (key === "D" && event.shiftKey) {
        event.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}

const GROUPS: { title: string; rows: [string[], string][] }[] = [
  {
    title: "Anywhere",
    rows: [
      [["N"], "Quick add (or /)"],
      [["Ctrl", "K"], "Go to or search"],
      [["Ctrl", "J"], "Chat with Tiki"],
      [["⇧", "H"], "Hide or show amounts"],
      [["⇧", "D"], "Light or dark theme"],
      [["?"], "These shortcuts"],
      [["Esc"], "Close a panel"],
    ],
  },
  {
    title: "Go to",
    rows: [
      [["G", "T"], "Today"],
      [["G", "P"], "Plan"],
      [["G", "D"], "Day"],
      [["G", "W"], "Week"],
      [["G", "M"], "Money"],
      [["G", "X"], "Transactions"],
      [["G", "B"], "Budgets"],
      [["G", "R"], "Review"],
      [["G", "S"], "Shutdown"],
      [["G", ","], "Settings"],
    ],
  },
  {
    title: "In a list",
    rows: [
      [["J"], "Next"],
      [["K"], "Previous"],
      [["Enter"], "Open"],
      [["X"], "Complete or undo"],
      [["T"], "Add to or take off top three"],
      [["Delete"], "Delete, with Undo"],
    ],
  },
];

export function ShortcutsDialog() {
  const open = useStore(shortcutsOpenStore);
  return (
    <Dialog.Root open={open} onOpenChange={shortcutsOpenStore.set}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[min(720px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 animate-fade-in overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-title">Keyboard shortcuts</Dialog.Title>
          <Dialog.Description className="mt-1 text-callout text-muted">
            Single letters work anywhere outside a text field.
          </Dialog.Description>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {GROUPS.map((group) => (
              <section key={group.title}>
                <h3 className="mb-2 text-caption text-muted">{group.title}</h3>
                <dl className="flex flex-col gap-2">
                  {group.rows.map(([keys, label]) => (
                    <div key={label} className="flex items-center justify-between gap-3">
                      <dt className="text-callout">{label}</dt>
                      <dd className="flex gap-1">
                        {keys.map((k) => (
                          <Kbd key={k}>{k}</Kbd>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

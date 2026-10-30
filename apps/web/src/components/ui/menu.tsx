import type { LucideIcon } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import type { ReactNode } from "react";
import { cx } from "./cx";

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  shortcut?: string;
}

/** A small menu of actions behind a trigger (a "more" button on a row or panel). */
export function Menu({
  trigger,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  items: (MenuItem | "separator")[];
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={align}
          sideOffset={4}
          className="z-50 min-w-48 animate-fade-in rounded-2xl border border-line bg-card p-1 shadow-xl shadow-ink/10"
        >
          {items.map((item, index) =>
            item === "separator" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: separators have no identity
              <DropdownMenu.Separator key={index} className="my-1 h-px bg-line" />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cx(
                  "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-callout font-semibold outline-none select-none data-[disabled]:opacity-40 data-[highlighted]:bg-line/60",
                  item.danger && "text-coral-text",
                )}
              >
                {item.icon ? <item.icon aria-hidden className="size-4" /> : null}
                <span className="flex-1">{item.label}</span>
                {item.shortcut ? (
                  <span className="text-caption text-muted">{item.shortcut}</span>
                ) : null}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

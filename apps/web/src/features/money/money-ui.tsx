import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";

/** The quiet delete beside a panel's Save (the phone's DeleteButton); Undo follows in a toast. */
export function DeleteButton({
  onClick,
  label = "Delete",
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <Button variant="danger" icon={Trash2} onClick={onClick}>
      {label}
    </Button>
  );
}

/** A panel's fields while its record loads. */
export function PanelSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-5 pt-2">
      {Array.from({ length: fields }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder fields
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * The row's swipe tray on a wide screen: a "more" button at the row's end that shows
 * on hover or focus, and stays while its menu is open.
 */
export function RowMenu({ label, items }: { label: string; items: (MenuItem | "separator")[] }) {
  return (
    <Menu
      items={items}
      trigger={
        <IconButton
          icon={MoreHorizontal}
          label={label}
          size="sm"
          tooltip={false}
          className="opacity-100 transition-opacity focus-visible:opacity-100 data-[state=open]:opacity-100 sm:opacity-0 sm:group-focus-within/row:opacity-100 sm:group-hover/row:opacity-100"
        />
      }
    />
  );
}

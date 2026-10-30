import { Archive, Pencil, Trash2 } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import type { MenuItem } from "@/components/ui/menu";
import { api, unwrap } from "@/lib/api";
import { plural } from "@/lib/format";
import { notify } from "@/lib/toast";
import { fire, remove as removeRecord } from "@/lib/write";

interface AccountRef {
  id: string;
  name: string;
}

/** How many transactions name the account; `more` once past one page. Null when it can't tell. */
async function countTransactions(accountId: string) {
  try {
    const page = await unwrap(api.transactions.$get({ query: { accountId, limit: "200" } }));
    return { count: page.items.length, more: page.nextCursor !== null };
  } catch {
    return null;
  }
}

interface Pending {
  account: AccountRef;
  what: string;
  resolve: (confirmed: boolean) => void;
}

/**
 * Archive and delete for an account, shared by its panel and its row menu. Deleting
 * keeps the account's transactions (they still count in history and totals, with no
 * account shown), so an account that has any asks first: the one confirmation dialog
 * in the app. Render `dialog` once wherever the hook is used.
 */
export function useAccountActions() {
  const [pending, setPending] = useState<Pending | null>(null);

  const archive = (account: AccountRef) => {
    fire({ method: "PATCH", path: `/accounts/${account.id}`, body: { archived: true } });
    notify(`Archived ${account.name}`, {
      label: "Undo",
      onPress: () =>
        fire({ method: "PATCH", path: `/accounts/${account.id}`, body: { archived: false } }),
    });
  };

  /** Resolves true once the account is deleted, false if the person backed out. */
  const remove = async (account: AccountRef): Promise<boolean> => {
    const found = await countTransactions(account.id);
    if (found?.count !== 0) {
      const what = found
        ? `Its ${found.more ? `${found.count}+ transactions` : plural(found.count, "transaction")}`
        : "Any transactions in it";
      const confirmed = await new Promise<boolean>((resolve) =>
        setPending({ account, what, resolve }),
      );
      setPending(null);
      if (!confirmed) return false;
    }
    try {
      await removeRecord(`/accounts/${account.id}`, `“${account.name}”`);
      return true;
    } catch {
      return false;
    }
  };

  const menuItems = (account: AccountRef, onEdit: () => void): MenuItem[] => [
    { label: "Edit", icon: Pencil, onSelect: onEdit },
    { label: "Archive", icon: Archive, onSelect: () => archive(account) },
    { label: "Delete", icon: Trash2, danger: true, onSelect: () => void remove(account) },
  ];

  const dialog: ReactNode = (
    <AlertDialog.Root
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) pending?.resolve(false);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 animate-fade-in bg-ink/30" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-3xl bg-card p-6 shadow-2xl">
          <AlertDialog.Title className="text-heading">
            Delete “{pending?.account.name}”?
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-callout text-muted">
            {pending?.what} will stay in your history and totals, but show no account. Archive it
            instead to just hide it.
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant="danger" onClick={() => pending?.resolve(true)}>
                Delete
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );

  return { archive, remove, menuItems, dialog };
}

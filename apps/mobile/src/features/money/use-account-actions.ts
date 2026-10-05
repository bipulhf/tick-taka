import { Alert } from "react-native";
import { editDelete, type RowAction } from "@/components/ui/swipe-row";
import { api, unwrap } from "@/lib/api";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { useRemove } from "@/lib/use-remove";

interface AccountRef {
  id: string;
  name: string;
}

/** How many transactions name the account; `more` once past one page. Null when offline. */
async function countTransactions(accountId: string) {
  try {
    const page = await unwrap(api.transactions.$get({ query: { accountId, limit: "200" } }));
    return { count: page.items.length, more: page.nextCursor !== null };
  } catch {
    return null;
  }
}

/**
 * Archive and delete for an account, shared by its edit sheet and its swipe tray.
 * Deleting keeps the account's transactions (they still count in history and
 * totals, with no account shown), so an account that has any asks first.
 */
export function useAccountActions() {
  const send = useOutbox();
  const removeRecord = useRemove();

  const archive = (account: AccountRef) => {
    send({ method: "PATCH", path: `/accounts/${account.id}`, body: { archived: true } });
    notify(`Archived ${account.name}`, {
      label: "Undo",
      onPress: () =>
        send({ method: "PATCH", path: `/accounts/${account.id}`, body: { archived: false } }),
    });
  };

  /** Resolves true once the account is deleted, false if I backed out. */
  const remove = async (account: AccountRef): Promise<boolean> => {
    const name = `“${account.name}”`;
    const found = await countTransactions(account.id);
    if (found?.count !== 0) {
      const what = found
        ? `Its ${found.count}${found.more ? "+" : ""} ${found.count === 1 ? "transaction" : "transactions"}`
        : "Any transactions in it";
      const confirmed = await new Promise<boolean>((resolve) =>
        Alert.alert(
          `Delete ${name}?`,
          `${what} will stay in your history and totals, but show no account. Archive it instead to just hide it.`,
          [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Delete", style: "destructive", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!confirmed) return false;
    }
    removeRecord(`/accounts/${account.id}`, name);
    return true;
  };

  /** The swipe tray: Edit, Archive, Delete. */
  const rowActions = (account: AccountRef, onEdit: () => void): RowAction[] => {
    const actions = editDelete(onEdit, () => void remove(account));
    // Archive sits between Edit and Delete.
    actions.splice(1, 0, {
      label: "Archive",
      icon: "archive-outline",
      tone: "muted",
      onPress: () => archive(account),
    });
    return actions;
  };

  return { archive, remove, rowActions };
}

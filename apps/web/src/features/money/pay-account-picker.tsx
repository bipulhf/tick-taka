import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { Toggle } from "@/components/ui/toggle";
import { createStore, useStore } from "@/lib/store";
import type { PayAccount } from "./pay-account";

export interface PayAccountChoice {
  accountId: string;
  /** Save it on the bill, so the next Paid doesn't ask. */
  remember: boolean;
}

interface Request {
  billName: string;
  income: boolean;
  accounts: PayAccount[];
  resolve: (choice: PayAccountChoice | null) => void;
}

const requestStore = createStore<Request | null>(null);

/** Asks which account a bill was paid from (or an income landed in); null when cancelled. */
export function pickPayAccount(input: Omit<Request, "resolve">): Promise<PayAccountChoice | null> {
  requestStore.get()?.resolve(null);
  return new Promise((resolve) => requestStore.set({ ...input, resolve }));
}

/** The dialog behind `pickPayAccount`, mounted once at the app's root. */
export function PayAccountPicker() {
  const request = useStore(requestStore);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    setAccountId(request?.accounts[0]?.id ?? null);
    setRemember(true);
  }, [request]);

  const finish = (choice: PayAccountChoice | null) => {
    request?.resolve(choice);
    requestStore.set(null);
  };
  const chosen = request?.accounts.find((a) => a.id === accountId);

  return (
    <Dialog.Root open={request !== null} onOpenChange={(open) => !open && finish(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] animate-fade-in bg-ink/30" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[80] w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-3xl bg-card p-6 shadow-2xl">
          <Dialog.Title className="text-heading">
            {request?.income ? "Which account did it land in?" : "Which account paid it?"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-callout text-muted">
            {request?.billName} has no account yet.
          </Dialog.Description>
          <fieldset className="mt-4 flex flex-col gap-1.5">
            <legend className="sr-only">Account</legend>
            {request?.accounts.map((account) => {
              const selected = account.id === accountId;
              return (
                <label
                  key={account.id}
                  className={cx(
                    "cursor-pointer rounded-xl border px-3.5 py-2.5 text-body font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-sky-text",
                    selected
                      ? "border-ink bg-ink text-background"
                      : "border-line bg-background hover:border-line-strong",
                  )}
                >
                  <input
                    type="radio"
                    name="pay-account"
                    value={account.id}
                    checked={selected}
                    onChange={() => setAccountId(account.id)}
                    className="sr-only"
                  />
                  {account.name}
                </label>
              );
            })}
          </fieldset>
          <div className="mt-4 flex items-center justify-between gap-3 text-callout">
            <label htmlFor="pay-account-remember">
              Use {chosen?.name ?? "it"} for {request?.billName} from now on
            </label>
            <Toggle id="pay-account-remember" checked={remember} onChange={setRemember} />
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => finish(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!accountId}
              onClick={() => accountId && finish({ accountId, remember })}
            >
              {request?.income ? "Received" : "Paid"}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

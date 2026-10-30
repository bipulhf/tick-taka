import { Banknote } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { formatWhen } from "@/lib/format";
import { useAccounts, useCategories, useSettings } from "@/lib/queries";
import { userTime } from "@/lib/user-time";
import { type ChatDraft, draftView } from "./money-drafts";

/**
 * A money change Tiki proposed: amount with its sign, account, category and date,
 * with Save and Discard. Nothing is written until Save.
 */
export function DraftCard({
  draft,
  onSave,
  onDiscard,
}: {
  draft: ChatDraft;
  onSave: () => void;
  onDiscard: () => void;
}) {
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: settings } = useSettings();
  const view = draftView(draft, { accounts, categories });
  const details = [
    view.account,
    view.category,
    view.date ? formatWhen(view.date, true, Date.now(), userTime(settings).timeZone) : null,
  ].filter(Boolean);

  if (draft.state === "discarded")
    return (
      <p className="px-1 text-caption text-muted">Discarded: {view.title}. Nothing was saved.</p>
    );
  // Once saved it shows in the list of changes above, with its Undo.
  if (draft.state === "saved") return null;
  return (
    <div className="flex w-full flex-col gap-3 rounded-2xl border border-line-strong bg-card p-4">
      <div className="flex items-center gap-2">
        <Banknote aria-hidden className="size-[18px] shrink-0 text-muted" />
        <p className="line-clamp-2 flex-1 text-callout text-muted">{view.title} · not saved yet</p>
      </div>
      {view.amountMinor !== null ? (
        <Amount
          minor={view.amountMinor}
          signed={view.signed}
          tone={view.signed ? "flow" : undefined}
          animate={false}
          className="text-title"
        />
      ) : null}
      {details.length ? <p className="line-clamp-2 text-callout">{details.join(" · ")}</p> : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onDiscard} aria-label={`Discard: ${view.title}`}>
          Discard
        </Button>
        <Button
          className="flex-1"
          variant="primary"
          onClick={onSave}
          aria-label={`Save: ${view.title}`}
        >
          Save
        </Button>
      </div>
    </div>
  );
}

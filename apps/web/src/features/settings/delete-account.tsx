import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TextField } from "@/components/ui/text-field";
import { deleteAccount } from "@/lib/auth";
import { friendlyError } from "@/lib/error-copy";
import {
  canDeleteAccount,
  DELETE_ACCOUNT_SUMMARY,
  DELETE_WORD,
  exportStepNote,
} from "./delete-account-rules";
import { useExportData } from "./use-export-data";

const COPY_CONFIRM_LABEL = "I've checked my copy is saved, or I don't need one";

/**
 * The one action that can't be undone: what goes, a copy first, then a typed
 * confirmation before anything is sent.
 */
export function DeleteAccount({ onCancel }: { onCancel: () => void }) {
  const { busy: exporting, downloaded, exportData } = useExportData();
  const [typed, setTyped] = useState("");
  const [copyConfirmed, setCopyConfirmed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmed = canDeleteAccount(typed, copyConfirmed);

  const remove = async () => {
    if (!confirmed) return;
    setDeleting(true);
    setError(null);
    try {
      // On success the session ends and the app goes back to the sign-in page.
      await deleteAccount();
    } catch (e) {
      setError(friendlyError(e));
      setDeleting(false);
    }
  };

  return (
    <section
      aria-label="Delete account"
      className="flex flex-col gap-5 rounded-2xl border border-line-strong bg-card p-5"
    >
      <div>
        <h3 className="text-heading">Delete account</h3>
        <p className="mt-1 text-body text-muted">{DELETE_ACCOUNT_SUMMARY}</p>
      </div>
      <section className="flex flex-col items-start gap-3">
        <h4 className="text-body font-bold">1. Keep a copy</h4>
        <p className="text-callout text-muted">{exportStepNote(downloaded)}</p>
        <Button icon={Download} loading={exporting} onClick={exportData}>
          Export all data
        </Button>
        {/* Clicking the words ticks the box too; the box is named on its own. */}
        {/* biome-ignore lint/a11y/noLabelWithoutControl: the round checkbox inside is a button, which a label activates */}
        <label className="flex cursor-pointer items-center gap-3 text-body">
          <Checkbox
            checked={copyConfirmed}
            onChange={setCopyConfirmed}
            label={COPY_CONFIRM_LABEL}
            tone="mint"
          />
          <span aria-hidden>{COPY_CONFIRM_LABEL}</span>
        </label>
      </section>
      <form
        className="flex flex-col items-start gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void remove();
        }}
      >
        <h4 className="text-body font-bold">2. Confirm</h4>
        <TextField
          label={`Type ${DELETE_WORD} to confirm`}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          error={error}
          className="w-full max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="danger"
            icon={Trash2}
            className="border border-coral-text/50"
            disabled={!confirmed}
            loading={deleting}
          >
            Delete my account
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={deleting}>
            Keep my account
          </Button>
        </div>
      </form>
    </section>
  );
}

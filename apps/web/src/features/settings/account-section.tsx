import { Download, LogOut, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { profileStore, signOut } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { DeleteAccount } from "./delete-account";
import { GroupLabel } from "./setting-row";
import { useExportData } from "./use-export-data";

/**
 * Who is signed in and the way out, a copy of everything, and, last and quiet, deleting
 * the account (its own steps: the export question, then a typed confirmation).
 */
export function AccountSection() {
  const profile = useStore(profileStore);
  const { busy, exportData } = useExportData();
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  return (
    <>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-4">
        {profile?.pictureUrl ? (
          <img
            src={profile.pictureUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-12 shrink-0 rounded-full"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-sky/15 text-sky-text">
            <UserRound aria-hidden className="size-6" />
          </span>
        )}
        <div className="min-w-[12rem] flex-1">
          <p className="truncate text-body font-bold">{profile?.name ?? "Signed in with Google"}</p>
          {profile ? <p className="truncate text-callout text-muted">{profile.email}</p> : null}
        </div>
        <Button
          icon={LogOut}
          loading={signingOut}
          onClick={() => {
            setSigningOut(true);
            void signOut();
          }}
        >
          Sign out
        </Button>
      </div>

      <GroupLabel>Your data</GroupLabel>
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-4">
        <p className="min-w-[12rem] flex-1 text-callout text-muted">
          Everything lives on the server, apart from everyone else's. Download a copy now and then:
          one JSON file with all your records.
        </p>
        <Button icon={Download} loading={busy} onClick={exportData}>
          Export all data
        </Button>
      </div>

      <GroupLabel>Danger zone</GroupLabel>
      {deleting ? (
        <DeleteAccount onCancel={() => setDeleting(false)} />
      ) : (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-line-strong/60 p-4">
          <p className="min-w-[12rem] flex-1 text-callout text-muted">
            Deletes your account and everything in it, at once and for good.
          </p>
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>
            Delete account…
          </Button>
        </div>
      )}
    </>
  );
}

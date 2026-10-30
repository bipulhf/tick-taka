import { LogOut, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { profileStore, signOut } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { DeleteAccount } from "./delete-account";

/**
 * The Google account this space belongs to, and the way out of it. It sits at the end
 * of Settings; deleting the account opens its own steps with export and a typed confirm.
 */
export function AccountSection() {
  const profile = useStore(profileStore);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  return (
    <Section id="settings-account" title="Account">
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
      {deleting ? (
        <DeleteAccount onCancel={() => setDeleting(false)} />
      ) : (
        <div>
          <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setDeleting(true)}>
            Delete account…
          </Button>
        </div>
      )}
    </Section>
  );
}

import { LogOut, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ToggleRow } from "@/components/ui/toggle";
import { notify } from "@/lib/toast";
import { write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { type AdminUser, ago, bytes, dollars, useAdminUsage, useAdminUsers } from "./queries";
import { UserAvatar } from "./user-avatar";

const CAPS = [null, 250_000, 500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000];
const DEFAULT = "default";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-callout text-muted">{label}</dt>
      <dd className="text-callout font-semibold tabular">{value}</dd>
    </div>
  );
}

/** Typed confirmation before an account and everything in it are deleted. */
function DeleteUser({ user, onDone }: { user: AdminUser; onDone: () => void }) {
  const [typing, setTyping] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  if (!typing)
    return (
      <Button variant="danger" size="sm" icon={Trash2} onClick={() => setTyping(true)}>
        Delete this account…
      </Button>
    );
  const matches = email.trim().toLowerCase() === user.email;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-coral-text/50 p-4">
      <p className="text-callout">
        Deletes {user.email} and everything in it (records, receipts, backups) at once and for good.
        Type the email to confirm.
      </p>
      <TextField
        label="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={user.email}
        autoComplete="off"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setTyping(false)}>
          Keep it
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={Trash2}
          disabled={!matches}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await write({
                method: "DELETE",
                path: `/admin/users/${user.id}`,
                body: { confirmEmail: email.trim() },
                label: "Couldn't delete the account",
              });
              notify(`Deleted ${user.email}`);
              onDone();
            } catch {
              setBusy(false);
            }
          }}
        >
          Delete for good
        </Button>
      </div>
    </div>
  );
}

/**
 * One account: the facts the owner may see (activity, devices, AI cost, storage,
 * record counts) and the levers (sign out, block, AI off or capped, delete). The
 * owner's own account shows the facts only.
 */
export function AdminUserPanel({ id, onClose }: PanelComponentProps) {
  const { data: users } = useAdminUsers();
  const { data: usage } = useAdminUsage();
  const user = users?.find((u) => u.id === id);
  const counts = usage?.perUser.find((u) => u.id === id);
  const kinds = usage?.totals ?? [];

  const patch = (body: Partial<Pick<AdminUser, "blocked" | "aiDisabled" | "aiCapMicros">>) =>
    write({
      method: "PATCH",
      path: `/admin/users/${id}`,
      body,
      label: "Couldn't change the account",
    }).catch(() => {});

  return (
    <Panel open onClose={onClose} title={user ? (user.name ?? user.email) : "Account"} width="lg">
      {!user ? (
        users ? (
          <EmptyState message="That account isn't here any more." mood="calm" />
        ) : null
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-heading">{user.name ?? "No name"}</p>
              <p className="truncate text-callout text-muted">{user.email}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-card">
            <dl aria-label="Account facts" className="divide-y divide-line">
              <Fact label="Joined" value={ago(user.createdAt)} />
              <Fact label="Last active" value={ago(user.lastActiveAt)} />
              <Fact label="Signed-in devices" value={String(user.liveSessions)} />
              <Fact
                label="AI this month"
                value={`${dollars(user.aiThisMonth.costMicros)} · ${user.aiThisMonth.calls} calls`}
              />
              <Fact
                label="Storage"
                value={`${bytes(user.storage.total)} (data ${bytes(user.storage.database)}, receipts ${bytes(user.storage.uploads)}, backups ${bytes(user.storage.backups)})`}
              />
              <Fact label="Last nightly backup" value={user.lastBackup ?? "Not yet"} />
            </dl>
          </div>

          {counts ? (
            <section aria-labelledby="admin-user-records" className="flex flex-col gap-2">
              <h3 id="admin-user-records" className="px-1 text-caption text-muted">
                Records (counts only) · {counts.last30Days} added in the last 30 days
              </h3>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {kinds.map((kind) => (
                  <div key={kind.kind} className="rounded-xl bg-background px-3 py-2">
                    <dt className="truncate text-caption font-normal text-muted">{kind.label}</dt>
                    <dd className="text-body font-bold tabular">
                      {counts.counts[kind.kind as keyof typeof counts.counts] ?? 0}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {counts ? (
            <section aria-labelledby="admin-user-last-used" className="flex flex-col gap-2">
              <h3 id="admin-user-last-used" className="px-1 text-caption text-muted">
                Last used (dates only)
              </h3>
              <div className="overflow-hidden rounded-2xl bg-card">
                <dl className="divide-y divide-line">
                  {(usage?.features ?? []).map((feature) => {
                    const at = counts.lastUsed[feature.kind];
                    return (
                      <Fact
                        key={feature.kind}
                        label={feature.label}
                        value={at === null ? "Never" : ago(at)}
                      />
                    );
                  })}
                </dl>
              </div>
            </section>
          ) : null}

          {user.isOwner ? (
            <p className="text-callout text-muted">
              This is your own account. The controls below don't apply to the owner.
            </p>
          ) : (
            <>
              <section aria-labelledby="admin-user-access" className="flex flex-col gap-2">
                <h3 id="admin-user-access" className="px-1 text-caption text-muted">
                  Access
                </h3>
                <Group>
                  <ToggleRow
                    label="Blocked"
                    description="Can't sign in; every device is signed out at once"
                    checked={user.blocked}
                    onChange={(blocked) => void patch({ blocked })}
                  />
                  <ToggleRow
                    label="AI off"
                    description="Every AI feature refuses, whatever their own settings say"
                    checked={user.aiDisabled}
                    onChange={(aiDisabled) => void patch({ aiDisabled })}
                  />
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-[12rem] flex-1">
                      <p className="text-body font-semibold">Monthly AI limit</p>
                      <p className="text-callout text-muted">Overrides the server's default cap</p>
                    </div>
                    <Select
                      ariaLabel="Monthly AI limit"
                      size="sm"
                      className="w-full sm:w-44"
                      value={user.aiCapMicros === null ? DEFAULT : String(user.aiCapMicros)}
                      options={CAPS.map((cap) => ({
                        value: cap === null ? DEFAULT : String(cap),
                        label: cap === null ? "Server default" : `${dollars(cap)} a month`,
                      }))}
                      onChange={(value) =>
                        void patch({ aiCapMicros: value === DEFAULT ? null : Number(value) })
                      }
                    />
                  </div>
                </Group>
              </section>
              <div className="flex flex-wrap items-start gap-3">
                <Button
                  icon={LogOut}
                  size="sm"
                  disabled={user.liveSessions === 0}
                  onClick={() =>
                    void write({
                      method: "POST",
                      path: `/admin/users/${id}/sign-out`,
                      label: "Couldn't sign them out",
                    })
                      .then(() => notify(`Signed ${user.email} out everywhere`))
                      .catch(() => {})
                  }
                >
                  Sign out everywhere
                </Button>
                <DeleteUser user={user} onDone={onClose} />
              </div>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}

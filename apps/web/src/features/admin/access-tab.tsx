import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { write } from "@/lib/write";
import { useAdminAccess } from "./queries";

/** Who may sign up: anyone, or only invited emails. Existing accounts always can. */
export function AccessTab() {
  const { data, isPending, isError, refetch } = useAdminAccess();
  const [email, setEmail] = useState("");
  const [adding, setAdding] = useState(false);
  if (isPending) return <SkeletonRows rows={3} />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const add = async () => {
    if (!valid) return;
    setAdding(true);
    try {
      await write({
        method: "POST",
        path: "/admin/access/emails",
        body: { email: email.trim() },
        label: "Couldn't add the email",
      });
      setEmail("");
    } catch {
      // The toast said why; the email stays to fix.
    } finally {
      setAdding(false);
    }
  };
  return (
    <div className="flex flex-col gap-7">
      <Section
        title="Sign-ups"
        caption="People who already have an account can always sign in, unless you block them."
      >
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-4">
          <p className="min-w-[14rem] flex-1 text-callout text-muted">
            {data.mode === "open"
              ? "Anyone with a Google account can sign up."
              : "Only the emails below can make a new account."}
          </p>
          <Segmented<"open" | "invite">
            label="Who can sign up"
            value={data.mode}
            onChange={(mode) =>
              void write({
                method: "PUT",
                path: "/admin/access",
                body: { mode },
                label: "Couldn't change sign-ups",
              }).catch(() => {})
            }
            options={[
              { value: "open", label: "Anyone" },
              { value: "invite", label: "Invite only" },
            ]}
          />
        </div>
      </Section>

      <Section title="Invited emails" caption="Only used while sign-ups are invite-only">
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
        >
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="friend@example.com"
            className="flex-1"
          />
          <Button type="submit" icon={Plus} loading={adding} disabled={!valid}>
            Invite
          </Button>
        </form>
        {data.emails.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line-strong/50 px-4 py-3 text-callout text-muted">
            Nobody invited yet.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card">
            {data.emails.map((entry) => (
              <li key={entry.email} className="flex items-center gap-3 px-4 py-2">
                <span className="flex-1 truncate text-body font-semibold">{entry.email}</span>
                <IconButton
                  icon={X}
                  size="sm"
                  label={`Remove ${entry.email}`}
                  onClick={() =>
                    void write({
                      method: "DELETE",
                      path: `/admin/access/emails/${encodeURIComponent(entry.email)}`,
                      label: "Couldn't remove the email",
                    }).catch(() => {})
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

import { Search } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useOpenPanel } from "@/lib/panel";
import { type AdminUser, ago, bytes, dollars, useAdminUsers } from "./queries";
import { UserAvatar } from "./user-avatar";

function Badges({ user }: { user: AdminUser }) {
  const badges = [
    user.isOwner ? "Owner" : null,
    user.blocked ? "Blocked" : null,
    user.aiDisabled ? "AI off" : null,
    user.aiCapMicros !== null ? `AI cap ${dollars(user.aiCapMicros)}` : null,
  ].filter(Boolean);
  return badges.length ? (
    <span className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span
          key={badge}
          className={
            badge === "Blocked"
              ? "rounded-full bg-coral/15 px-2 py-0.5 text-caption text-coral-text"
              : "rounded-full bg-line/70 px-2 py-0.5 text-caption text-muted"
          }
        >
          {badge}
        </span>
      ))}
    </span>
  ) : null;
}

/** Every account, most recently active first; a row opens its facts and actions. */
export function UsersTab() {
  const { data, isPending, isError, refetch } = useAdminUsers();
  const open = useOpenPanel();
  const [query, setQuery] = useState("");
  if (isPending) return <SkeletonRows rows={5} />;
  if (isError || !data) return <ErrorState onRetry={() => void refetch()} />;
  const q = query.trim().toLowerCase();
  const users = q
    ? data.filter((u) => u.email.includes(q) || (u.name ?? "").toLowerCase().includes(q))
    : data;
  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Find by name or email"
          aria-label="Find a user"
          className="h-10 w-full rounded-xl border border-line-strong bg-card pr-3 pl-9 text-body outline-none focus:border-sky-text focus:ring-2 focus:ring-sky/25"
        />
      </div>
      {users.length === 0 ? (
        <EmptyState icon={Search} message="Nobody matches that." />
      ) : (
        <Group>
          {users.map((user) => (
            <Row
              key={user.id}
              dataKey={`admin-user:${user.id}`}
              leading={<UserAvatar user={user} />}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  {user.name ?? user.email}
                  <Badges user={user} />
                </span>
              }
              subtitle={`${user.email} · joined ${ago(user.createdAt)} · active ${ago(user.lastActiveAt)}`}
              trailing={
                <span className="hidden items-center gap-6 text-callout text-muted md:flex">
                  <span className="w-24 text-right tabular" title="Signed-in devices">
                    {user.liveSessions} device{user.liveSessions === 1 ? "" : "s"}
                  </span>
                  <span className="w-24 text-right tabular" title="AI cost this month">
                    {dollars(user.aiThisMonth.costMicros)}
                  </span>
                  <span className="w-20 text-right tabular" title="Storage">
                    {bytes(user.storage.total)}
                  </span>
                </span>
              }
              onClick={() => open(`admin-user:${user.id}`)}
              chevron
            />
          ))}
        </Group>
      )}
    </div>
  );
}

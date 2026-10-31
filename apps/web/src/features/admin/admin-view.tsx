import { Link } from "@tanstack/react-router";
import { cx } from "@/components/ui/cx";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ViewSkeleton } from "@/components/ui/skeleton";
import { AccessTab } from "./access-tab";
import { AiTab } from "./ai-tab";
import { HealthTab } from "./health-tab";
import { OverviewTab } from "./overview-tab";
import { useMe } from "./queries";
import { UsageTab } from "./usage-tab";
import { UsersTab } from "./users-tab";

export const ADMIN_TABS = [
  { id: "overview", label: "Overview", render: () => <OverviewTab /> },
  { id: "users", label: "Users", render: () => <UsersTab /> },
  { id: "usage", label: "Usage", render: () => <UsageTab /> },
  { id: "ai", label: "AI cost", render: () => <AiTab /> },
  { id: "health", label: "Server", render: () => <HealthTab /> },
  { id: "access", label: "Access", render: () => <AccessTab /> },
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number]["id"];

export const isAdminTab = (value: unknown): value is AdminTab =>
  ADMIN_TABS.some((tab) => tab.id === value);

/**
 * The owner's dashboard: account facts and counts, AI cost, the server, and who may
 * sign up. Nobody's records are shown here, only how many there are.
 */
export function AdminView({ tab = "overview" }: { tab?: AdminTab }) {
  const me = useMe();
  if (!me.data) return <ViewSkeleton />;
  if (!me.data.isAdmin)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Admin" />
        <EmptyState message="This area is only for the owner of the service." mood="calm" />
      </div>
    );
  const current = ADMIN_TABS.find((t) => t.id === tab) ?? ADMIN_TABS[0];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Admin"
        subtitle="Account facts, usage and the server. Never anyone's records."
      />
      <nav aria-label="Admin sections" className="-mx-1 overflow-x-auto">
        <ul className="flex w-max gap-1 rounded-2xl bg-line/50 p-1">
          {ADMIN_TABS.map((t) => (
            <li key={t.id}>
              <Link
                to="/admin"
                search={{ tab: t.id }}
                aria-current={t.id === current.id ? "page" : undefined}
                className={cx(
                  "flex h-9 items-center rounded-xl px-4 text-callout font-bold whitespace-nowrap transition-colors",
                  t.id === current.id ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {current.render()}
    </div>
  );
}

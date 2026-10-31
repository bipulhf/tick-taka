import { createFileRoute } from "@tanstack/react-router";
import { type AdminTab, AdminView, isAdminTab } from "@/features/admin/admin-view";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

export const Route = createFileRoute("/_auth/_shell/admin")({
  validateSearch: (search: Record<string, unknown>): PanelSearch & { tab?: AdminTab } => ({
    ...validatePanelSearch(search),
    ...(isAdminTab(search.tab) ? { tab: search.tab } : {}),
  }),
  component: AdminPage,
});

function AdminPage() {
  const { tab } = Route.useSearch();
  return <AdminView tab={tab} />;
}

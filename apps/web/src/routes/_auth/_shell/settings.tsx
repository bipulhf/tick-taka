import { createFileRoute } from "@tanstack/react-router";
import {
  isSettingsSection,
  type SettingsSectionId,
  SettingsView,
} from "@/features/settings/settings-view";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

export const Route = createFileRoute("/_auth/_shell/settings")({
  validateSearch: (
    search: Record<string, unknown>,
  ): PanelSearch & { section?: SettingsSectionId } => ({
    ...validatePanelSearch(search),
    ...(isSettingsSection(search.section) ? { section: search.section } : {}),
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { section } = Route.useSearch();
  return <SettingsView section={section} />;
}

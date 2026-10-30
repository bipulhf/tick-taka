import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/app-shell";
import { QuickAddBar } from "@/features/quick-add/quick-add-bar";
import { validatePanelSearch } from "@/lib/panel";

export const Route = createFileRoute("/_auth/_shell")({
  validateSearch: validatePanelSearch,
  component: () => <AppShell quickAdd={<QuickAddBar />} />,
});

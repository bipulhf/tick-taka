import { createFileRoute } from "@tanstack/react-router";
import { SettingsView } from "@/features/settings/settings-view";

export const Route = createFileRoute("/_auth/_shell/settings")({
  component: SettingsView,
});

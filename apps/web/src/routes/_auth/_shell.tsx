import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/app-shell";
import { QuickAddBar } from "@/features/quick-add/quick-add-bar";
import { RunningTimer } from "@/features/timer/running-timer";
import { TodayPalette } from "@/features/today/palette";
import { validatePanelSearch } from "@/lib/panel";

export const Route = createFileRoute("/_auth/_shell")({
  validateSearch: validatePanelSearch,
  component: Shell,
});

function Shell() {
  return (
    <>
      <TodayPalette />
      <AppShell quickAdd={<QuickAddBar />} timer={<RunningTimer />} />
    </>
  );
}

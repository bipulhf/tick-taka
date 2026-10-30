import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/shell/app-shell";
import { AssistantButton, AssistantPalette } from "@/features/assistant/assistant-button";
import { AssistantDock } from "@/features/assistant/assistant-dock";
import { MoneyPalette } from "@/features/money/money-palette";
import { QuickAddBar } from "@/features/quick-add/quick-add-bar";
import { BrowserReminders } from "@/features/settings/browser-reminders";
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
      <MoneyPalette />
      <AssistantPalette />
      <BrowserReminders />
      <AppShell
        quickAdd={<QuickAddBar />}
        timer={<RunningTimer />}
        assistantButton={<AssistantButton />}
        assistantDock={<AssistantDock />}
      />
    </>
  );
}

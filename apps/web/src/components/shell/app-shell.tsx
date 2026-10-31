import { Outlet } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useIsDesk } from "@/components/ui/use-media";
import { PanelHost } from "@/features/panel-host";
import { BottomTabs } from "./bottom-tabs";
import { CommandPalette } from "./command-palette";
import { OfflineBanner } from "./offline-banner";
import { ShortcutsDialog, useGlobalShortcuts } from "./shortcuts";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/**
 * Signed-in frame: sidebar (or bottom tabs on a phone), the top bar with quick-add,
 * the view, Tiki's dock beside it, and the edit panel the URL names.
 */
export function AppShell({
  quickAdd,
  timer,
  assistantButton,
  assistantDock,
}: {
  quickAdd: ReactNode;
  timer?: ReactNode;
  assistantButton?: ReactNode;
  assistantDock?: ReactNode;
}) {
  useGlobalShortcuts();
  const desk = useIsDesk();
  return (
    <div className="flex h-dvh overflow-hidden">
      <a
        href="#main"
        className="sr-only z-50 rounded-xl bg-ink px-3 py-2 text-background focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar forceRail={!desk} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <TopBar quickAdd={quickAdd} timer={timer} assistant={assistantButton} />
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
          <div className="w-full px-4 pt-6 pb-28 sm:px-8 sm:pb-16 xl:px-10">
            <Outlet />
          </div>
        </main>
      </div>
      {assistantDock}
      <BottomTabs />
      <PanelHost />
      <CommandPalette />
      <ShortcutsDialog />
    </div>
  );
}

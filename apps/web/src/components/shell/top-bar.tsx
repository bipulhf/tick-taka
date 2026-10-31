import { Eye, EyeOff, Moon, Search, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { togglePrivacy, usePrivacy } from "@/lib/prefs";
import { toggleTheme, useTheme } from "@/lib/theme";
import { paletteOpenStore } from "@/lib/ui-state";

/**
 * The slim bar over every view: quick-add in the middle (the one thing to reach
 * from anywhere), then the running timer, hide amounts, the theme and the palette.
 */
export function TopBar({ quickAdd, timer }: { quickAdd: ReactNode; timer?: ReactNode }) {
  const hidden = usePrivacy();
  const dark = useTheme() === "dark";
  return (
    <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line/70 bg-background/90 px-3 backdrop-blur-sm sm:px-5">
      <div className="min-w-0 flex-1">{quickAdd}</div>
      {timer}
      <div data-tour="top-tools" className="flex items-center gap-2">
        <IconButton
          icon={hidden ? EyeOff : Eye}
          label={hidden ? "Show amounts" : "Hide amounts"}
          shortcut="⇧ H"
          pressed={hidden}
          onClick={togglePrivacy}
        />
        <IconButton
          icon={dark ? Sun : Moon}
          label={dark ? "Switch to light theme" : "Switch to dark theme"}
          shortcut="⇧ D"
          onClick={toggleTheme}
        />
        <IconButton
          icon={Search}
          label="Go to or search"
          shortcut="Ctrl K"
          onClick={() => paletteOpenStore.set(true)}
          className="hidden sm:inline-flex"
        />
      </div>
    </div>
  );
}

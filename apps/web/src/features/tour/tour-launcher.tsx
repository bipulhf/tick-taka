import { Compass } from "lucide-react";
import { useEffect } from "react";
import { registerPaletteActions } from "@/components/shell/command-palette";
import { profileStore } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { AppTour } from "./app-tour";
import { startTour, tourDone } from "./tour-store";

/**
 * Starts the tour on someone's first visit in this browser (once Today has had a
 * moment to load), offers it again in the palette, and draws it.
 */
export function TourLauncher() {
  const profile = useStore(profileStore);
  const userId = profile?.id;

  useEffect(() => {
    if (!userId || tourDone(userId)) return;
    const timer = setTimeout(startTour, 900);
    return () => clearTimeout(timer);
  }, [userId]);

  useEffect(
    () =>
      registerPaletteActions(() => [
        {
          id: "tour",
          label: "Show the app tour",
          group: "Actions",
          keywords: ["help", "guide", "tutorial", "onboarding", "how"],
          icon: <Compass aria-hidden className="size-4 text-muted" />,
          run: startTour,
        },
      ]),
    [],
  );

  return <AppTour />;
}

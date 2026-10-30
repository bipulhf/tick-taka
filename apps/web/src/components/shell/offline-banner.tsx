import { WifiOff } from "lucide-react";
import { useIsOnline } from "@/lib/online";

/** Online only: when the network drops, one calm line says saving waits for it. */
export function OfflineBanner() {
  const online = useIsOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-caption text-background"
    >
      <WifiOff aria-hidden className="size-3.5" />
      You're offline. What's on screen stays; saving works again once you're back.
    </div>
  );
}

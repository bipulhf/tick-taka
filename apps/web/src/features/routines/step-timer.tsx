import { Hourglass, Play } from "lucide-react";
import { useState } from "react";
import { useNow } from "@/features/timer/use-now";
import { formatTimer } from "@/lib/format";

/** A step's own countdown: click to start, click again to reset. */
export function StepTimer({ minutes }: { minutes: number }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const now = useNow(1000, startedAt !== null);
  const left =
    startedAt === null ? minutes * 60_000 : Math.max(0, startedAt + minutes * 60_000 - now);
  const Icon = startedAt ? Hourglass : Play;
  return (
    <button
      type="button"
      onClick={() => setStartedAt(startedAt === null ? Date.now() : null)}
      aria-label={startedAt ? `Reset step timer, ${formatTimer(left)} left` : "Start step timer"}
      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 text-callout font-semibold tabular hover:bg-line/40"
    >
      <Icon aria-hidden className="size-4 text-sky" />
      {formatTimer(left)}
    </button>
  );
}

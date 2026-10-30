import { useQueryClient } from "@tanstack/react-query";
import { newId } from "@tick-taka/shared/ids";
import { Play, Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { NONE, Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleRow } from "@/components/ui/toggle";
import { useRunningTimer } from "@/features/timer/running-timer";
import { useNow } from "@/features/timer/use-now";
import { formatTimer } from "@/lib/format";
import { useAreas } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { updateToday } from "@/lib/today-cache";
import { fire } from "@/lib/write";

/** The hero: the running timer with Stop, or an area, Billable and Start. */
export function TimerCard() {
  const client = useQueryClient();
  const running = useRunningTimer();
  const { data: areas = [] } = useAreas();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [billable, setBillable] = useState(false);
  const active = running.data?.running ?? null;
  const now = useNow(1000, Boolean(active));

  if (!running.data) return <Skeleton className="h-44 rounded-3xl" />;

  const stop = () => {
    if (!active) return;
    client.setQueryData(["timer"], { running: null });
    updateToday(client, (d) => ({ ...d, runningTimer: null }));
    fire({ method: "POST", path: "/timer/stop", body: { id: active.id }, label: "Couldn't stop" });
  };
  const start = () => {
    fire({
      method: "POST",
      path: "/timer/start",
      // The click time, not the time the request reaches the server.
      body: { id: newId(), areaId, billable, source: "timer", startedAt: Date.now() },
      label: "Couldn't start",
    });
    notify("Timer started");
  };

  return (
    <section aria-label="Timer" className="flex flex-col gap-4 rounded-3xl bg-card p-6">
      {active ? (
        <>
          <p className="text-caption text-muted">Running</p>
          <p className="text-hero tabular" aria-live="off">
            {formatTimer(now - active.startedAt)}
          </p>
          <p className="text-body text-muted">
            {areas.find((a) => a.id === active.areaId)?.name ?? "No area"}
            {active.note ? ` · ${active.note}` : ""}
          </p>
          <Button icon={Square} onClick={stop} className="self-start">
            Stop
          </Button>
        </>
      ) : (
        <>
          <Select
            label="Area"
            value={areaId ?? NONE}
            onChange={(value) => setAreaId(value === NONE ? null : value)}
            options={[
              { value: NONE, label: "No area" },
              ...areas.map((area) => ({ value: area.id, label: area.name, leading: area.emoji })),
            ]}
          />
          <div className="-mx-4 overflow-hidden rounded-2xl">
            <ToggleRow label="Billable" checked={billable} onChange={setBillable} />
          </div>
          <Button variant="time" icon={Play} onClick={start} className="self-start">
            Start timer
          </Button>
        </>
      )}
    </section>
  );
}

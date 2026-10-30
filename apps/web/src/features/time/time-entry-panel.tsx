import { useQueryClient } from "@tanstack/react-query";
import { newId } from "@tick-taka/shared/ids";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateField, joinInstant, splitInstant, TimeField } from "@/components/ui/date-field";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { NONE, Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ToggleRow } from "@/components/ui/toggle";
import { api, unwrap } from "@/lib/api";
import { formatMinutes } from "@/lib/format";
import { useAreas } from "@/lib/queries";
import { useUserTime } from "@/lib/use-today";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";

const listEntries = () => unwrap(api["time-entries"].$get({ query: {} }));
type TimeEntry = Awaited<ReturnType<typeof listEntries>>[number];

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

/** A whole number from the preset, or null. */
function presetNumber(preset: URLSearchParams, key: string): number | null {
  const n = Number(preset.get(key) ?? "");
  return preset.get(key) && Number.isFinite(n) ? n : null;
}

/**
 * Manual time entry (`?panel=time-entry:new`, preset `note`, `minutes`, `startedAt`,
 * `areaId`): when it started and how long. With an id it edits that entry, found in
 * whichever week list it was opened from.
 */
export function TimeEntryPanel({ id, onClose, preset }: PanelComponentProps) {
  const client = useQueryClient();
  if (id === "new") return <TimeEntryForm entry={null} preset={preset} onClose={onClose} />;
  const entry = client
    .getQueriesData<TimeEntry[]>({ queryKey: ["time-entries"] })
    .flatMap(([, data]) => (Array.isArray(data) ? data : []))
    .find((e) => e.id === id && e.endedAt !== null);
  if (!entry)
    return (
      <Panel open onClose={onClose} title="Time">
        <EmptyState title="Entry not found" message="It may have been deleted on another device." />
      </Panel>
    );
  return <TimeEntryForm entry={entry} preset={preset} onClose={onClose} />;
}

function TimeEntryForm({
  entry,
  preset,
  onClose,
}: {
  entry: TimeEntry | null;
  preset: URLSearchParams;
  onClose: () => void;
}) {
  const { data: areas = [] } = useAreas();
  const { timeZone } = useUserTime();
  const [minutes, setMinutes] = useState(() =>
    entry?.endedAt
      ? Math.max(1, Math.round((entry.endedAt - entry.startedAt) / 60_000))
      : Math.max(1, Math.round(presetNumber(preset, "minutes") ?? 60)),
  );
  const [startedAt, setStartedAt] = useState(
    () => entry?.startedAt ?? presetNumber(preset, "startedAt") ?? Date.now() - minutes * 60_000,
  );
  const [areaId, setAreaId] = useState<string | null>(
    entry ? entry.areaId : preset.get("areaId") || null,
  );
  const [note, setNote] = useState(entry?.note ?? preset.get("note") ?? "");
  const [billable, setBillable] = useState(entry?.billable ?? false);
  const [saving, setSaving] = useState(false);
  const [initial] = useState(() => JSON.stringify([minutes, startedAt, areaId, note, billable]));
  const dirty = JSON.stringify([minutes, startedAt, areaId, note, billable]) !== initial;

  // An edited entry keeps its own length as a choice, e.g. a 37-minute focus session.
  const durations = DURATIONS.includes(minutes)
    ? DURATIONS
    : [...DURATIONS, minutes].sort((a, b) => a - b);
  const started = splitInstant(startedAt, timeZone);
  const body = {
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    areaId,
    note: note.trim() || null,
    billable,
  };

  const save = async () => {
    setSaving(true);
    try {
      if (entry)
        await write({
          method: "PATCH",
          path: `/time-entries/${entry.id}`,
          body,
          label: "Couldn't save",
        });
      else
        await write({
          method: "POST",
          path: "/time-entries",
          body: { id: newId(), ...body, source: "manual" },
          label: "Couldn't log time",
        });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={entry ? "Edit time" : "Log time"}
      dirty={dirty && !saving}
      footer={
        <>
          {entry ? (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                const area = areas.find((a) => a.id === entry.areaId);
                void remove(
                  `/time-entries/${entry.id}`,
                  `“${entry.note || area?.name || "Time"}”`,
                ).catch(() => {});
                onClose();
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button
            type="submit"
            form="time-entry-form"
            variant="primary"
            className="flex-1"
            loading={saving}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id="time-entry-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          aria-label="What did you work on?"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="What did you work on?"
          autoFocus={!entry}
        />
        <Select
          label="How long"
          value={String(minutes)}
          options={durations.map((d) => ({ value: String(d), label: formatMinutes(d) }))}
          onChange={(d) => setMinutes(Number(d))}
        />
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Started"
            value={started.date}
            onChange={(date) => {
              if (date) setStartedAt(joinInstant(date, started.time, timeZone));
            }}
          />
          <TimeField
            label="At"
            value={started.time}
            onChange={(time) => {
              if (time) setStartedAt(joinInstant(started.date, time, timeZone));
            }}
          />
        </div>
        <Select
          label="Area"
          value={areaId ?? NONE}
          options={[
            { value: NONE, label: "No area" },
            ...areas.map((area) => ({ value: area.id, label: area.name, leading: area.emoji })),
          ]}
          onChange={(value) => setAreaId(value === NONE ? null : value)}
        />
        <div className="overflow-hidden rounded-2xl border border-line">
          <ToggleRow label="Billable" checked={billable} onChange={setBillable} />
        </div>
      </form>
    </Panel>
  );
}

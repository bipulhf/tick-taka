import { endOfLocalDay, MINUTE_MS, toLocalDate } from "@tick-taka/shared/dates";
import { describeRRule } from "@tick-taka/shared/recurrence";
import { Chip } from "@/components/ui/chip";
import { DateField } from "@/components/ui/date-field";
import { Segmented } from "@/components/ui/segmented";
import { NONE, Select } from "@/components/ui/select";
import { TextField } from "@/components/ui/text-field";
import { ToggleRow } from "@/components/ui/toggle";
import type { Form, Priority } from "./task-form";

/** What sits behind the task panel's "More options": everything past When and Estimate. */
export function TaskMoreFields({
  form,
  set,
  setForm,
  today,
  timeZone,
  repeatText,
  setRepeatText,
  parsedRepeat,
  areas,
  projects,
}: {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  setForm: (update: (form: Form) => Form) => void;
  today: string;
  timeZone: string;
  repeatText: string;
  setRepeatText: (text: string) => void;
  parsedRepeat: { rrule: string } | null;
  areas: { id: string; name: string; emoji: string }[];
  projects: { id: string; name: string }[] | undefined;
}) {
  return (
    <>
      <DateField
        label="Deadline"
        clearable
        value={form.deadlineAt ? toLocalDate(form.deadlineAt, timeZone) : null}
        onChange={(date) =>
          set("deadlineAt", date ? endOfLocalDay(date, timeZone) - MINUTE_MS : null)
        }
      />

      <div className="flex flex-col gap-1.5">
        <TextField
          label="Repeat"
          value={repeatText}
          onChange={(event) => setRepeatText(event.target.value)}
          placeholder={form.rrule ? describeRRule(form.rrule) : "e.g. every other Tuesday"}
          error={repeatText.trim() && !parsedRepeat ? "Try “every month on the 5th”" : undefined}
        />
        {parsedRepeat ? (
          <p className="text-caption text-sky-text">↻ {describeRRule(parsedRepeat.rrule)}</p>
        ) : null}
        {form.rrule && !repeatText ? (
          <Chip className="self-start" onClick={() => set("rrule", null)}>
            Stop repeating
          </Chip>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-caption text-muted">Priority</span>
        <Segmented<Priority>
          label="Priority"
          value={form.priority}
          onChange={(v) => set("priority", v)}
          className="w-full"
          options={[
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-line [&>*+*]:border-t [&>*+*]:border-line">
        <ToggleRow
          label="In today's top three"
          checked={form.top3Date === today}
          onChange={(on) => set("top3Date", on ? today : null)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Area"
          value={form.areaId ?? NONE}
          onChange={(areaId) =>
            setForm((f) => ({ ...f, areaId: areaId === NONE ? null : areaId, projectId: null }))
          }
          options={[
            { value: NONE, label: "No area" },
            ...areas.map((area) => ({ value: area.id, label: area.name, leading: area.emoji })),
          ]}
        />
        {projects?.length ? (
          <Select
            label="Project"
            value={form.projectId ?? NONE}
            onChange={(projectId) => set("projectId", projectId === NONE ? null : projectId)}
            options={[
              { value: NONE, label: "No project" },
              ...projects.map((project) => ({ value: project.id, label: project.name })),
            ]}
          />
        ) : null}
      </div>
    </>
  );
}

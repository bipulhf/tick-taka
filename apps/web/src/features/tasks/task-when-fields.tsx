import { startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { useState } from "react";
import { DateField, joinInstant, splitInstant, TimeField } from "@/components/ui/date-field";
import { NONE, Select } from "@/components/ui/select";
import { formatMinutes, formatWhen } from "@/lib/format";
import { ESTIMATES, type Form, type WhenChoice, whenOf, withDate, withWhen } from "./task-form";

/** When (with its day and time) and Estimate: the fields every task gets asked. */
export function TaskWhenFields({
  form,
  setForm,
  today,
  timeZone,
}: {
  form: Form;
  setForm: (update: (form: Form) => Form) => void;
  today: string;
  timeZone: string;
}) {
  const when = whenOf(form, today, timeZone);
  // "Pick a date…" shows the day field until a day is set, even if it's today.
  const [picking, setPicking] = useState(false);
  const doDate = form.doAt ? toLocalDate(form.doAt, timeZone) : null;
  const showDate = picking || when === "pick";

  const pickWhen = (choice: string) => {
    if (choice === "pick") {
      setPicking(true);
      return;
    }
    setPicking(false);
    setForm((f) =>
      withWhen(
        f,
        (choice === NONE ? "none" : choice) as Exclude<WhenChoice, "pick">,
        today,
        timeZone,
      ),
    );
  };

  const setTime = (time: string | null) =>
    setForm((f) => {
      const date = f.doAt ? toLocalDate(f.doAt, timeZone) : today;
      return time
        ? {
            ...f,
            doAt: joinInstant(date, time, timeZone),
            hasTime: true,
            status: f.status === "done" ? "done" : "open",
          }
        : { ...f, doAt: startOfLocalDay(date, timeZone), hasTime: false };
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="When"
          value={showDate ? "pick" : (when ?? NONE)}
          onChange={pickWhen}
          options={[
            { value: NONE, label: "No date" },
            { value: "today", label: "Today" },
            { value: "evening", label: "This evening" },
            { value: "tomorrow", label: "Tomorrow" },
            {
              value: "pick",
              label:
                when === "pick" && form.doAt
                  ? `${formatWhen(form.doAt, false, Date.now(), timeZone)}${form.whenSlot === "evening" ? " · evening" : ""}`
                  : "Pick a date…",
            },
            { value: "someday", label: "Someday" },
          ]}
        />
        <Select
          label="Estimate"
          value={form.estimateMin === null ? NONE : String(form.estimateMin)}
          onChange={(minutes) =>
            setForm((f) => ({ ...f, estimateMin: minutes === NONE ? null : Number(minutes) }))
          }
          options={[
            { value: NONE, label: "No estimate" },
            ...ESTIMATES.map((minutes) => ({
              value: String(minutes),
              label: formatMinutes(minutes),
            })),
          ]}
        />
      </div>
      {showDate || form.doAt ? (
        <div className="grid grid-cols-2 gap-3">
          {showDate ? (
            <DateField
              label="Day"
              value={doDate}
              onChange={(date) => {
                if (!date) return;
                setPicking(false);
                setForm((f) => withDate(f, date, timeZone));
              }}
            />
          ) : null}
          {form.doAt ? (
            <TimeField
              label="Time"
              value={form.hasTime ? splitInstant(form.doAt, timeZone).time : null}
              onChange={setTime}
            />
          ) : null}
        </div>
      ) : null}
      {form.doAt && form.hasTime ? (
        <p className="-mt-2 text-caption font-normal text-muted">A reminder rings at this time.</p>
      ) : null}
    </>
  );
}

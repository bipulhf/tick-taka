import { addDays } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Panel } from "@/components/ui/panel";
import { TextField } from "@/components/ui/text-field";
import { useTodayDate } from "@/lib/use-today";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { AmountField } from "./amount-field";
import { amountText, readAmount } from "./amount-text";
import { EmojiGrid } from "./emoji-grid";
import { DeleteButton, PanelSkeleton } from "./money-ui";
import { type MoneyEvent, useEvents } from "./queries";

const EMOJIS = ["✈️", "🎉", "🕌", "🎂", "💍", "🏖️", "🏕️", "🎓", "🛍️"];

/** Create a trip or celebration with its own budget, or edit one. */
export function EventPanel({ id, onClose }: PanelComponentProps) {
  const { data: events } = useEvents();
  const event = id === "new" ? undefined : events?.find((e) => e.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (id !== "new" && !event)
    return (
      <Panel open onClose={onClose} title="Event">
        <PanelSkeleton fields={4} />
      </Panel>
    );
  return <EventForm event={event} onClose={onClose} />;
}

function EventForm({ event, onClose }: { event: MoneyEvent | undefined; onClose: () => void }) {
  const today = useTodayDate();
  const initial = {
    name: event?.name ?? "",
    emoji: event?.emoji ?? "✈️",
    budget: amountText(event?.budgetMinor),
    startsOn: event?.startsOn ?? today,
    endsOn: event?.endsOn ?? addDays(today, 3),
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<typeof initial>) => setForm((f) => ({ ...f, ...patch }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const save = async () => {
    if (!form.name.trim()) return;
    const body = {
      name: form.name.trim(),
      emoji: form.emoji,
      budgetMinor: readAmount(form.budget || "0") || null,
      startsOn: form.startsOn,
      endsOn: form.endsOn < form.startsOn ? form.startsOn : form.endsOn,
    };
    setSaving(true);
    try {
      if (event)
        await write({ method: "PATCH", path: `/events/${event.id}`, body, label: "Couldn't save" });
      else
        await write({
          method: "POST",
          path: "/events",
          body: { id: newId(), ...body },
          label: "Couldn't add the event",
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
      title={event ? event.name : "New event"}
      dirty={dirty}
      footer={
        <>
          {event ? (
            <DeleteButton
              onClick={() => {
                onClose();
                void remove(`/events/${event.id}`, `“${event.name}”`).catch(() => {});
              }}
            />
          ) : null}
          <Button
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!form.name.trim()}
            onClick={() => void save()}
          >
            {event ? "Save" : "Create event"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Name"
          value={form.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Sylhet trip"
          autoFocus={!event}
        />
        <EmojiGrid
          label="Emoji"
          value={form.emoji}
          options={EMOJIS}
          onChange={(emoji) => set({ emoji })}
        />
        <AmountField
          label="Budget (optional)"
          value={form.budget}
          onChange={(budget) => set({ budget })}
          placeholder="15000"
        />
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="From"
            value={form.startsOn}
            onChange={(startsOn) => startsOn && set({ startsOn })}
          />
          <DateField
            label="To"
            value={form.endsOn}
            min={form.startsOn}
            onChange={(endsOn) => endsOn && set({ endsOn })}
          />
        </div>
        <button type="submit" hidden />
      </form>
    </Panel>
  );
}

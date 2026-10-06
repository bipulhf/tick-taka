import { describeRRule } from "@tick-taka/shared/recurrence";
import type { Dispatch, SetStateAction } from "react";
import { View } from "react-native";
import { Chip } from "@/components/ui/chip";
import { PickerField } from "@/components/ui/picker-field";
import { Segmented } from "@/components/ui/segmented";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { ToggleRow } from "@/components/ui/toggle-row";
import { formatWhen } from "@/lib/format";
import type { Form, Priority } from "./task-form";

/** What sits behind the task sheet's "More options": everything past When and Estimate. */
export function TaskMoreFields({
  form,
  set,
  setForm,
  today,
  repeatText,
  setRepeatText,
  parsedRepeat,
  advanced,
  areas,
  projects,
  setDeadline,
}: {
  form: Form;
  set: <K extends keyof Form>(key: K, value: Form[K]) => void;
  setForm: Dispatch<SetStateAction<Form>>;
  today: string;
  repeatText: string;
  setRepeatText: (text: string) => void;
  parsedRepeat: { rrule: string } | null;
  advanced: { eisenhower: boolean; energy: boolean } | undefined;
  areas: { id: string; name: string; emoji: string }[];
  projects: { data?: { id: string; name: string }[] };
  setDeadline: () => Promise<void>;
}) {
  return (
    <>
      <PickerField
        label="Deadline"
        value={form.deadlineAt ? "pick" : null}
        noneLabel="No deadline"
        options={[
          {
            id: "pick",
            label: form.deadlineAt ? formatWhen(form.deadlineAt, false) : "Pick a date…",
          },
        ]}
        onChange={(choice) => (choice === null ? set("deadlineAt", null) : void setDeadline())}
      />
      <ToggleRow
        label="In today's top three"
        value={form.top3Date === today}
        onChange={(on) => set("top3Date", on ? today : null)}
      />

      <TextField
        label="Repeat"
        value={repeatText}
        onChangeText={setRepeatText}
        placeholder={form.rrule ? describeRRule(form.rrule) : "e.g. every other Tuesday"}
        error={repeatText && !parsedRepeat ? "Try “every month on the 5th”" : undefined}
      />
      {parsedRepeat ? (
        <Text variant="caption" tone="sky">
          ↻ {describeRRule(parsedRepeat.rrule)}
        </Text>
      ) : null}
      {form.rrule && !repeatText ? (
        <Chip label="Stop repeating" choice="action" onPress={() => set("rrule", null)} />
      ) : null}

      <Text variant="label" tone="muted">
        Priority
      </Text>
      <Segmented<Priority>
        label="Priority"
        value={form.priority}
        onChange={(v) => set("priority", v)}
        options={[
          { value: "low", label: "Low" },
          { value: "normal", label: "Normal" },
          { value: "high", label: "High" },
        ]}
      />
      {advanced?.eisenhower ? (
        <ToggleRow label="Urgent" value={form.urgent} onChange={(on) => set("urgent", on)} />
      ) : null}
      {advanced?.energy ? (
        <PickerField
          label="Energy"
          value={form.energy}
          noneLabel="Any energy"
          options={[
            { id: "high", label: "High energy", emoji: "⚡" },
            { id: "low", label: "Low energy", emoji: "🌙" },
          ]}
          onChange={(energy) => set("energy", energy as Form["energy"])}
        />
      ) : null}

      <View className="flex-row gap-3">
        <PickerField
          label="Area"
          span="half"
          value={form.areaId}
          noneLabel="No area"
          options={areas.map((area) => ({ id: area.id, label: area.name, emoji: area.emoji }))}
          onChange={(areaId) => setForm((f) => ({ ...f, areaId, projectId: null }))}
        />
        {projects.data?.length ? (
          <PickerField
            label="Project"
            span="half"
            value={form.projectId}
            noneLabel="No project"
            options={projects.data.map((project) => ({ id: project.id, label: project.name }))}
            onChange={(projectId) => set("projectId", projectId)}
          />
        ) : null}
      </View>
    </>
  );
}

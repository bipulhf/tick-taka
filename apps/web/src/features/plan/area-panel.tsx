import { newId } from "@tick-taka/shared/ids";
import { Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { ErrorState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { Panel } from "@/components/ui/panel";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Field, TextField } from "@/components/ui/text-field";
import { useAreas } from "@/lib/queries";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";

type Area = NonNullable<ReturnType<typeof useAreas>["data"]>[number];

/**
 * Area colours are stored as their light hex (the API checks a hex colour) but drawn
 * through the theme's tokens, so they adapt to dark mode, and announced by name.
 */
export const AREA_SWATCHES: { hex: string; name: string; css: string }[] = [
  { hex: "#5B8CFF", name: "Blue", css: "var(--tt-sky)" },
  { hex: "#7A6BFF", name: "Indigo", css: "light-dark(#7A6BFF, #9A8FFF)" },
  { hex: "#FFB547", name: "Mango", css: "var(--tt-mango)" },
  { hex: "#2EC4A0", name: "Green", css: "var(--tt-mint)" },
  { hex: "#FF7A6B", name: "Coral", css: "var(--tt-coral)" },
  { hex: "#A57BFF", name: "Purple", css: "var(--tt-grape)" },
];

const find = (hex: string) => AREA_SWATCHES.find((s) => s.hex.toLowerCase() === hex.toLowerCase());

/** The colour to draw for a stored area colour, in the current theme. */
export const areaColorValue = (hex: string) => find(hex)?.css ?? hex;
/** "Blue", "Purple"…; never a hex code. */
export const areaColorName = (hex: string) => find(hex)?.name ?? "Custom colour";

const EMOJIS = ["💼", "🏠", "💪", "📚", "💰", "❤️", "🧘", "🎨", "👨‍👩‍👧", "🕌", "✈️", "⭐"];

/** Add or edit an area of life: its emoji, name and colour, in one small panel. */
export function AreaPanel({ id, onClose }: PanelComponentProps) {
  const areas = useAreas();
  const editing = id !== "new";
  const area = editing ? areas.data?.find((a) => a.id === id) : undefined;
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (editing && !area)
    return (
      <Panel open onClose={onClose} title="Area">
        {areas.isError || areas.data ? (
          <ErrorState
            onRetry={() => void areas.refetch()}
            message={areas.data ? "That area is no longer here." : undefined}
          />
        ) : (
          <SkeletonRows rows={3} />
        )}
      </Panel>
    );
  return <AreaForm area={area} count={areas.data?.length ?? 0} onClose={onClose} />;
}

function AreaForm({
  area,
  count,
  onClose,
}: {
  area: Area | undefined;
  count: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(area?.name ?? "");
  const [emoji, setEmoji] = useState(area?.emoji ?? "⭐");
  const [color, setColor] = useState(
    area?.color ?? AREA_SWATCHES[count % AREA_SWATCHES.length]?.hex ?? "#5B8CFF",
  );
  const [saving, setSaving] = useState(false);
  const valid = Boolean(name.trim() && emoji.trim());
  const dirty = area
    ? name !== area.name || emoji !== area.emoji || color !== area.color
    : Boolean(name.trim());

  const save = async () => {
    if (!valid) return;
    const body = { name: name.trim(), emoji: emoji.trim(), color };
    setSaving(true);
    try {
      if (area)
        await write({ method: "PATCH", path: `/areas/${area.id}`, body, label: "Couldn't save" });
      else
        await write({
          method: "POST",
          path: "/areas",
          body: { id: newId(), ...body, sort: count },
          label: "Couldn't save",
        });
      onClose();
    } catch {
      // The toast said why; what was typed stays.
      setSaving(false);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={area ? area.name : "New area"}
      dirty={dirty && !saving}
      headerActions={
        area ? (
          <IconButton
            icon={Trash2}
            label="Delete area"
            onClick={() => {
              void remove(`/areas/${area.id}`, `“${area.name}”`).catch(() => {});
              onClose();
            }}
          />
        ) : null
      }
      footer={
        <Button
          variant="primary"
          block
          loading={saving}
          disabled={!valid}
          onClick={() => void save()}
        >
          {area ? "Save" : "Add area"}
        </Button>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <div className="flex gap-2">
          <TextField
            aria-label="Emoji"
            value={emoji}
            onChange={(event) => setEmoji(event.target.value)}
            className="w-16"
          />
          <TextField
            aria-label="Area name"
            placeholder="Work, Home, Health…"
            value={name}
            autoFocus={!area}
            onChange={(event) => setName(event.target.value)}
            className="flex-1"
          />
        </div>
        <Field label="Emoji">
          <div role="radiogroup" aria-label="Emoji" className="grid grid-cols-6 gap-1.5">
            {EMOJIS.map((e) => (
              // biome-ignore lint/a11y/useSemanticElements: an emoji grid, styled as tiles
              <button
                key={e}
                type="button"
                role="radio"
                aria-checked={emoji.trim() === e}
                aria-label={e}
                onClick={() => setEmoji(e)}
                className={cx(
                  "flex h-11 items-center justify-center rounded-xl text-heading transition-colors",
                  emoji.trim() === e ? "bg-ink/10 ring-2 ring-ink" : "hover:bg-line/60",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Colour">
          <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-3">
            {AREA_SWATCHES.map((swatch) => (
              // biome-ignore lint/a11y/useSemanticElements: round colour swatches
              <button
                key={swatch.hex}
                type="button"
                role="radio"
                aria-checked={color === swatch.hex}
                aria-label={swatch.name}
                onClick={() => setColor(swatch.hex)}
                className="flex size-11 items-center justify-center rounded-full"
                style={{ backgroundColor: swatch.css }}
              >
                {color === swatch.hex ? (
                  <Check aria-hidden className="size-5 text-on-mango" strokeWidth={3} />
                ) : null}
              </button>
            ))}
          </div>
        </Field>
      </form>
    </Panel>
  );
}

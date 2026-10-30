import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useState } from "react";
import { cx } from "@/components/ui/cx";

export interface DropInfo {
  /** How far below the drop area's top edge the card's top landed, in px. */
  offsetY: number;
}

/**
 * Drag to schedule. A press that moves less than 6 px is still a click, so cards
 * keep opening on click; the card follows the pointer in an overlay. Every move a
 * drag makes is also in the card's menu, for the keyboard and screen readers.
 */
export function PlanDnd({
  onDrop,
  renderOverlay,
  children,
}: {
  onDrop: (id: string, zone: string, info: DropInfo) => void;
  renderOverlay: (id: string) => ReactNode;
  children: ReactNode;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const end = (event: DragEndEvent) => {
    setActive(null);
    const { active: dragged, over } = event;
    if (!over) return;
    const top = dragged.rect.current.translated?.top ?? over.rect.top;
    onDrop(String(dragged.id), String(over.id), { offsetY: top - over.rect.top });
  };
  return (
    <DndContext
      sensors={sensors}
      onDragStart={(event) => setActive(String(event.active.id))}
      onDragCancel={() => setActive(null)}
      onDragEnd={end}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Drag with the mouse, or use the card's More menu to move it.",
        },
      }}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {active ? (
          <div className="cursor-grabbing rounded-xl shadow-xl shadow-ink/15">
            {renderOverlay(active)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Makes its child draggable by `id`; the child stays in place, faded, while it moves. */
export function Draggable({
  id,
  children,
  className,
}: {
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id });
  return (
    <div
      ref={setNodeRef}
      // Only the pointer listener: keys stay with the card's own buttons and menu.
      onPointerDown={listeners?.onPointerDown as React.PointerEventHandler | undefined}
      className={cx(isDragging && "opacity-40", className)}
    >
      {children}
    </div>
  );
}

/** A place a card can be dropped; shows a sky ring while one hovers over it. */
export function DropArea({
  id,
  children,
  className,
  style,
  label,
}: {
  id: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      style={style}
      className={cx(
        "transition-shadow duration-150",
        isOver && "ring-2 ring-sky-text ring-offset-2 ring-offset-background",
        className,
      )}
    >
      {children}
    </section>
  );
}

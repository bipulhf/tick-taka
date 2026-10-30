import type { ComponentType } from "react";

/** Every edit panel: `id` is a record's id or "new"; `onClose` drops it from the URL. */
export interface PanelComponentProps {
  id: string;
  onClose: () => void;
  /** Starting values for a new record (`?preset=`). */
  preset: URLSearchParams;
}

export type PanelRegistry = Record<string, ComponentType<PanelComponentProps>>;

import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";

/**
 * Edit panels live in the URL (`?panel=task:<id>`, `?panel=expense:new`), so Back
 * closes them and a link opens one. `preset` carries starting values for a new
 * record as a query string ("doDate=2026-10-30&areaId=…").
 */
export interface PanelSearch {
  panel?: string;
  preset?: string;
}

export function validatePanelSearch(search: Record<string, unknown>): PanelSearch {
  return {
    panel: typeof search.panel === "string" && search.panel ? search.panel : undefined,
    preset: typeof search.preset === "string" && search.preset ? search.preset : undefined,
  };
}

/** "task:01J…" → { kind: "task", id: "01J…" }; "expense:new" → id "new". */
export function parsePanel(panel: string | undefined): { kind: string; id: string } | null {
  if (!panel) return null;
  const at = panel.indexOf(":");
  return at === -1
    ? { kind: panel, id: "new" }
    : { kind: panel.slice(0, at), id: panel.slice(at + 1) || "new" };
}

export function usePanelSearch(): PanelSearch {
  return useSearch({ strict: false }) as PanelSearch;
}

/** Opens a panel over the current view, or closes it with `null`. */
export function useOpenPanel() {
  const navigate = useNavigate();
  return useCallback(
    (
      panel: string | null,
      preset?: Record<string, string | number | boolean | null | undefined>,
    ) => {
      const presetText = preset
        ? new URLSearchParams(
            Object.entries(preset).flatMap(([key, value]) =>
              value === undefined || value === null ? [] : [[key, String(value)]],
            ),
          ).toString()
        : undefined;
      void navigate({
        to: ".",
        search: ((previous: Record<string, unknown>) => ({
          ...previous,
          panel: panel ?? undefined,
          preset: panel ? presetText || undefined : undefined,
        })) as never,
      });
    },
    [navigate],
  );
}

/** Starting values for a new record, from `preset`. */
export function usePreset(): URLSearchParams {
  return new URLSearchParams(usePanelSearch().preset ?? "");
}

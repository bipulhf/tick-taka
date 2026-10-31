import { Suspense } from "react";
import { parsePanel, useOpenPanel, usePanelSearch } from "@/lib/panel";
import { adminPanels } from "./admin/panels";
import { moneyPanels } from "./money/panels";
import { planPanels } from "./plan/panels";
import { reviewPanels } from "./review/panels";
import { todayPanels } from "./today/panels";

const PANELS = { ...todayPanels, ...planPanels, ...moneyPanels, ...reviewPanels, ...adminPanels };

/** Shows the panel the URL names, over whichever view is open. */
export function PanelHost() {
  const search = usePanelSearch();
  const open = useOpenPanel();
  const parsed = parsePanel(search.panel);
  const Component = parsed ? PANELS[parsed.kind] : undefined;
  if (!parsed || !Component) return null;
  return (
    <Suspense fallback={null}>
      <Component
        // A different record is a fresh form, never the last one's leftovers.
        key={`${parsed.kind}:${parsed.id}`}
        id={parsed.id}
        preset={new URLSearchParams(search.preset ?? "")}
        onClose={() => open(null)}
      />
    </Suspense>
  );
}

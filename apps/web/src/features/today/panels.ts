import { lazy } from "react";
import type { PanelRegistry } from "../panel-types";

/** This area's edit panels, by the kind in `?panel=<kind>:<id>`. */
export const todayPanels: PanelRegistry = {
  task: lazy(() => import("../tasks/task-panel").then((m) => ({ default: m.TaskPanel }))),
  "top-three": lazy(() =>
    import("../tasks/pick-top-three-panel").then((m) => ({ default: m.PickTopThreePanel })),
  ),
  "time-entry": lazy(() =>
    import("../time/time-entry-panel").then((m) => ({ default: m.TimeEntryPanel })),
  ),
};

import { lazy } from "react";
import type { PanelRegistry } from "../panel-types";
import { AreaPanel } from "./area-panel";

/** This area's edit panels, by the kind in `?panel=<kind>:<id>`. */
export const planPanels: PanelRegistry = {
  area: AreaPanel,
  project: lazy(() => import("./project-panel").then((m) => ({ default: m.ProjectPanel }))),
  habit: lazy(() => import("../habits/habit-panel").then((m) => ({ default: m.HabitPanel }))),
};

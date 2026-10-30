import type { PanelRegistry } from "../panel-types";
import { AreaPanel } from "./area-panel";

/** This area's edit panels, by the kind in `?panel=<kind>:<id>`. */
export const planPanels: PanelRegistry = { area: AreaPanel };

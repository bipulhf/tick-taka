import type { PanelRegistry } from "../panel-types";
import { AdminUserPanel } from "./user-panel";

/** The admin area's panels, by the kind in `?panel=<kind>:<id>`. */
export const adminPanels: PanelRegistry = { "admin-user": AdminUserPanel };

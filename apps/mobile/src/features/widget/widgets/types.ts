import type { WidgetCache } from "../widget-cache";
import type { LookColors } from "../widget-colors";

/** What every widget is drawn from. */
export interface WidgetProps {
  /** The widget's registered name (widget-names.ts): its Undo strip shows only here. */
  name: string;
  cache: WidgetCache;
  c: LookColors;
  /** The widget's size on the launcher (dp); 0 when it isn't known. */
  width: number;
  height: number;
  now: number;
}

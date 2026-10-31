import { NAV } from "@/components/shell/nav";

export const APP_TITLE = "Tick & Taka";

/** What the window title can show besides the route: a chosen section or tab, a record's name. */
export interface TitleExtras {
  /** Settings section or admin tab label ("Your day", "Users"). */
  part?: string;
  /** The name of the area, project or routine the page is about. */
  name?: string;
}

/**
 * The window title for a route inside /app, most specific first so a row of tabs stays
 * readable: "Transactions · Money · Tick & Taka". Pure, so it can be tested.
 */
export function pageTitle(path: string, extras: TitleExtras = {}): string {
  const parts = titleParts(path, extras);
  return [...parts, APP_TITLE].join(" · ");
}

function titleParts(path: string, { part, name }: TitleExtras): string[] {
  if (path === "/" || path === "") return ["Today"];
  if (path.startsWith("/plan/area/")) return [name ?? "Area", "Plan"];
  if (path.startsWith("/plan/project/")) return [name ?? "Project", "Plan"];
  if (path.startsWith("/plan/routine/")) return [name ?? "Routine", "Routines"];
  if (path.startsWith("/settings")) return [part ? `Settings › ${part}` : "Settings"];
  if (path.startsWith("/admin")) return [part ? `Admin › ${part}` : "Admin"];
  if (path.startsWith("/focus")) return ["Focus"];
  if (path.startsWith("/login")) return ["Sign in"];
  for (const section of NAV) {
    if (section.to === "/") continue;
    const child = section.children.find((c) => c.to === path);
    if (child) return child.to === section.to ? [section.label] : [child.label, section.label];
    if (path === section.to) return [section.label];
  }
  return [];
}

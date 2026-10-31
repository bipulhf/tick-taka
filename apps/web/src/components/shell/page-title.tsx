import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { ADMIN_TABS } from "@/features/admin/admin-view";
import { useAllProjects } from "@/features/plan/queries";
import { useRoutines } from "@/features/routines/queries";
import { SETTINGS_SECTION_LABELS } from "@/features/settings/settings-view";
import { pageTitle } from "@/lib/page-title";
import { useAreas } from "@/lib/queries";

/** Keeps the window title on the page that's open (signed-in pages; sign-in sets its own). */
export function PageTitle() {
  const { path, search } = useRouterState({
    select: (s) => ({
      path: s.location.pathname.replace(/^\/app/, "") || "/",
      search: s.location.search as Record<string, unknown>,
    }),
  });
  const id = path.split("/")[3];
  const { data: areas } = useAreas();
  const { data: projects } = useAllProjects();
  const { data: routines } = useRoutines();

  const name = path.startsWith("/plan/area/")
    ? areas?.find((a) => a.id === id)?.name
    : path.startsWith("/plan/project/")
      ? projects?.find((p) => p.id === id)?.name
      : path.startsWith("/plan/routine/")
        ? routines?.find((r) => r.id === id)?.name
        : undefined;
  const part = path.startsWith("/settings")
    ? SETTINGS_SECTION_LABELS[String(search.section ?? "")]
    : path.startsWith("/admin")
      ? ADMIN_TABS.find((t) => t.id === search.tab)?.label
      : undefined;

  const title = pageTitle(path, { name, part });
  useEffect(() => {
    document.title = title;
  }, [title]);
  return null;
}

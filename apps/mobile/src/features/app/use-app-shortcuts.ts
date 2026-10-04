import * as QuickActions from "expo-quick-actions";
import { useQuickActionRouting } from "expo-quick-actions/router";
import { useEffect } from "react";

/** Long-press the app icon: "Add expense" and "Start focus". */
export function useAppShortcuts() {
  useQuickActionRouting();
  useEffect(() => {
    void QuickActions.setItems([
      {
        id: "add-expense",
        title: "Add expense",
        icon: "add",
        params: { href: "/add?kind=expense" },
      },
      { id: "start-focus", title: "Start focus", icon: "time", params: { href: "/focus" } },
      { id: "quick-add", title: "Quick add", icon: "compose", params: { href: "/add" } },
    ]);
  }, []);
}

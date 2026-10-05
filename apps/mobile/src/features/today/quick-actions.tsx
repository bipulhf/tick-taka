import { useRouter } from "expo-router";
import { ShortcutRow } from "@/components/ui/shortcut-row";

/** The four things logged most often, one tap from Today: no menus, no hunting. */
export function QuickActions() {
  const router = useRouter();
  return (
    <ShortcutRow
      items={[
        {
          label: "Task",
          icon: "checkbox-marked-circle-plus-outline",
          color: "sky",
          onPress: () => router.push("/add?kind=task"),
        },
        {
          label: "Expense",
          icon: "cash-minus",
          color: "coral",
          onPress: () => router.push("/add?kind=expense"),
        },
        {
          label: "Income",
          icon: "cash-plus",
          color: "mint",
          onPress: () => router.push("/add?kind=income"),
        },
        {
          label: "Focus",
          icon: "sprout",
          color: "grape",
          onPress: () => router.push("/focus"),
        },
      ]}
    />
  );
}

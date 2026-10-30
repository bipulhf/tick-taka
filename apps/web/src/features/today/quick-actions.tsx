import { useNavigate } from "@tanstack/react-router";
import { CircleCheckBig, CircleMinus, CirclePlus, type LucideIcon, Sprout } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { useOpenPanel } from "@/lib/panel";

interface Shortcut {
  label: string;
  icon: LucideIcon;
  tint: string;
  run: () => void;
}

/** The four things logged most often, one click from Today: no menus, no hunting. */
export function QuickActions() {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const items: Shortcut[] = [
    {
      label: "Task",
      icon: CircleCheckBig,
      tint: "bg-sky/15 text-sky-text",
      run: () => open("task:new"),
    },
    {
      label: "Expense",
      icon: CircleMinus,
      tint: "bg-coral/15 text-coral-text",
      run: () => open("transaction:new", { type: "expense" }),
    },
    {
      label: "Income",
      icon: CirclePlus,
      tint: "bg-mint/15 text-mint-text",
      run: () => open("transaction:new", { type: "income" }),
    },
    {
      label: "Focus",
      icon: Sprout,
      tint: "bg-sky/15 text-sky-text",
      run: () => void navigate({ to: "/focus" }),
    },
  ];
  return (
    <nav aria-label="Quick logs" className="grid grid-cols-4 gap-2">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.run}
          className="flex flex-col items-center gap-2 rounded-2xl py-2 transition-colors hover:bg-line/40"
        >
          <span
            aria-hidden
            className={cx("flex size-12 items-center justify-center rounded-2xl", item.tint)}
          >
            <item.icon className="size-6" strokeWidth={2} />
          </span>
          <span className="text-caption">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

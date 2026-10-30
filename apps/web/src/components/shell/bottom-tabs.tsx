import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { focusQuickAdd } from "@/lib/ui-state";
import { NAV, sectionOf } from "./nav";
import { usePath } from "./sidebar";

/**
 * Phones only: the Android app's floating capsule of four tabs with the mango
 * quick-add in the middle. The open tab is marked by ink and a soft pill.
 */
export function BottomTabs() {
  const path = usePath();
  const current = sectionOf(path);
  // Settings and Focus belong to no tab; Today is only "/" itself.
  const isOpen = (to: string) => current.to === to && (to !== "/" || path === "/");
  const [today, plan, money, review] = NAV;
  const tab = (section: typeof today) =>
    section ? (
      <Link
        key={section.to}
        to={section.to}
        aria-current={isOpen(section.to) ? "page" : undefined}
        className={cx(
          "flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-tab font-bold",
          isOpen(section.to) ? "bg-line/70 text-ink" : "text-muted",
        )}
      >
        <section.icon aria-hidden className="size-5" />
        {section.label}
      </Link>
    ) : null;
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-3 z-30 flex h-16 items-center gap-1 rounded-[28px] bg-card px-2 shadow-xl shadow-ink/10 sm:hidden"
    >
      {tab(today)}
      {tab(plan)}
      <button
        type="button"
        aria-label="Quick add"
        onClick={focusQuickAdd}
        className="mx-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-mango text-on-mango shadow-md shadow-mango/40"
      >
        <Plus aria-hidden className="size-6" strokeWidth={2.6} />
      </button>
      {tab(money)}
      {tab(review)}
    </nav>
  );
}

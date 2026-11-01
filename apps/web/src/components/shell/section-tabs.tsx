import { Link, Outlet } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { cx } from "@/components/ui/cx";
import { activeTab, NAV, type NavSection } from "./nav";
import { usePath } from "./sidebar";

/**
 * A section's pages as a row of tabs over the view, from nav.ts so the sidebar,
 * the palette and the shortcuts agree. The open page is an ink pill, never mango;
 * on a narrow screen the row scrolls sideways.
 */
export function SectionTabs({ section }: { section: NavSection }) {
  const path = usePath();
  const open = activeTab(path, section);
  const row = useRef<HTMLElement>(null);
  const openTo = open?.to;
  // On a narrow screen, bring the open tab into the row's view (sideways only).
  useEffect(() => {
    const nav = row.current;
    const tab = openTo ? nav?.querySelector<HTMLElement>("[aria-current=page]") : null;
    if (!nav || !tab) return;
    const left = tab.offsetLeft - nav.offsetLeft;
    if (left < nav.scrollLeft || left + tab.offsetWidth > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = left - 16;
  }, [openTo]);
  return (
    <nav ref={row} aria-label={`${section.label} pages`} className="-mx-1 -my-1 overflow-x-auto">
      <ul className="flex w-max gap-1 p-1">
        {section.children.map((link) => {
          const current = link.to === open?.to;
          return (
            <li key={link.to}>
              <Link
                to={link.to}
                // The router marks a link current on its own; agree with activeTab.
                activeOptions={{ exact: link.to === section.to, includeSearch: false }}
                aria-current={current ? "page" : undefined}
                className={cx(
                  "flex h-9 items-center rounded-full px-4 text-callout font-bold whitespace-nowrap transition-colors duration-150",
                  current ? "bg-ink text-background" : "text-muted hover:bg-line/60 hover:text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The layout of /plan, /money and /review: the section's tabs, then the view. */
export function SectionLayout({ to }: { to: "/plan" | "/money" | "/review" }) {
  const section = NAV.find((s) => s.to === to) as NavSection;
  return (
    <div className="flex flex-col gap-6">
      <SectionTabs section={section} />
      <Outlet />
    </div>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { Tiki } from "@/components/tiki/tiki";
import { cx } from "@/components/ui/cx";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { profileStore, signOut } from "@/lib/auth";
import { railStore, toggleRail } from "@/lib/prefs";
import { useAreas, useSettings } from "@/lib/queries";
import { useStore } from "@/lib/store";
import { NAV, type NavLink, sectionOf } from "./nav";

/** The current path inside /app, "/" for Today. */
export function usePath(): string {
  return useRouterState({
    select: (state) => state.location.pathname.replace(/^\/app/, "") || "/",
  });
}

function isActive(path: string, to: string, exact: boolean) {
  return exact ? path === to : path === to || path.startsWith(`${to}/`);
}

function Item({
  link,
  active,
  rail,
  depth = 0,
}: {
  link: NavLink;
  active: boolean;
  rail: boolean;
  depth?: 0 | 1;
}) {
  const content = (
    <Link
      to={link.to}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? link.label : undefined}
      className={cx(
        "flex items-center gap-2.5 rounded-xl font-semibold transition-colors duration-150",
        rail ? "size-10 justify-center" : "h-9 px-2.5",
        depth === 1 && !rail && "h-8 text-callout",
        active
          ? "bg-card text-ink shadow-sm shadow-ink/5"
          : "text-muted hover:bg-line/50 hover:text-ink",
      )}
    >
      <link.icon
        aria-hidden
        className={cx("shrink-0", depth === 1 ? "size-4" : "size-[18px]")}
        strokeWidth={active ? 2.4 : 2}
      />
      {rail ? null : <span className="truncate">{link.label}</span>}
    </Link>
  );
  return rail ? (
    <Tooltip
      label={link.label}
      side="right"
      shortcut={link.key ? `G ${link.key.toUpperCase()}` : undefined}
    >
      {content}
    </Tooltip>
  ) : (
    content
  );
}

/**
 * The wide-screen sidebar, a step darker than the page: the four places, the open
 * one's views beneath it, areas while planning, Settings and the account at the foot.
 * Folds to an icon rail on medium screens or when the person chooses.
 */
export function Sidebar({ forceRail }: { forceRail: boolean }) {
  const path = usePath();
  const chosenRail = useStore(railStore);
  const rail = forceRail || chosenRail;
  const section = sectionOf(path);
  const { data: settings } = useSettings();
  const { data: areas } = useAreas();
  const profile = useStore(profileStore);
  const advanced = settings?.advancedViews;

  return (
    <nav
      aria-label="Main"
      className={cx(
        "hidden shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-chrome py-4 sm:flex",
        rail ? "w-[68px] items-center px-2" : "w-[248px] px-3",
      )}
    >
      <div className={cx("mb-3 flex items-center gap-2", rail ? "flex-col" : "px-1.5")}>
        <Link to="/" aria-label="Today" className="flex items-center gap-2 rounded-xl">
          <Tiki mood="happy" size={32} />
          {rail ? null : <span className="text-heading font-extrabold">Tick & Taka</span>}
        </Link>
        {forceRail ? null : (
          <IconButton
            icon={rail ? PanelLeftOpen : PanelLeftClose}
            label={rail ? "Show sidebar" : "Fold sidebar"}
            size="sm"
            className={rail ? "" : "ml-auto"}
            onClick={toggleRail}
          />
        )}
      </div>

      {NAV.map((top) => {
        const open = top.to === section.to;
        const children = top.children.filter(
          (child) => !child.advanced || advanced?.[child.advanced],
        );
        return (
          <div key={top.to} className={cx("flex flex-col gap-0.5", rail && "items-center")}>
            <Item
              link={top}
              active={open && (rail || children.length === 0 || path === top.to)}
              rail={rail}
            />
            {open && !rail && children.length > 0 ? (
              <div className="mt-0.5 mb-2 ml-3 flex flex-col gap-0.5 border-l border-line pl-2">
                {children.map((child) => (
                  <Item
                    key={child.to}
                    link={child}
                    depth={1}
                    rail={false}
                    active={isActive(path, child.to, child.to === top.to)}
                  />
                ))}
                {top.to === "/plan" && areas && areas.length > 0 ? (
                  <>
                    <p className="mt-3 mb-1 px-2.5 text-caption text-muted">Areas</p>
                    {areas.map((area) => {
                      const to = `/plan/area/${area.id}`;
                      return (
                        <Link
                          key={area.id}
                          to="/plan/area/$id"
                          params={{ id: area.id }}
                          aria-current={path === to ? "page" : undefined}
                          className={cx(
                            "flex h-8 items-center gap-2.5 rounded-xl px-2.5 text-callout font-semibold transition-colors",
                            path === to
                              ? "bg-card text-ink shadow-sm shadow-ink/5"
                              : "text-muted hover:bg-line/50 hover:text-ink",
                          )}
                        >
                          <span aria-hidden className="w-4 text-center">
                            {area.emoji}
                          </span>
                          <span className="truncate">{area.name}</span>
                        </Link>
                      );
                    })}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}

      <div className={cx("mt-auto flex flex-col gap-1 pt-4", rail && "items-center")}>
        <Item
          link={{ to: "/settings", label: "Settings", icon: Settings }}
          active={path.startsWith("/settings")}
          rail={rail}
        />
        {profile ? (
          <Menu
            align="start"
            items={[{ label: "Sign out", icon: LogOut, onSelect: () => void signOut() }]}
            trigger={
              <button
                type="button"
                aria-label={`Account: ${profile.email}`}
                className={cx(
                  "flex items-center gap-2.5 rounded-xl text-left hover:bg-line/50",
                  rail ? "size-10 justify-center" : "h-11 px-2",
                )}
              >
                {profile.pictureUrl ? (
                  <img
                    src={profile.pictureUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-7 shrink-0 rounded-full"
                  />
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-mango text-caption text-on-mango">
                    {(profile.name ?? profile.email).slice(0, 1).toUpperCase()}
                  </span>
                )}
                {rail ? null : (
                  <span className="min-w-0">
                    <span className="block truncate text-callout font-bold">
                      {profile.name ?? profile.email}
                    </span>
                    <span className="block truncate text-caption font-normal text-muted">
                      {profile.email}
                    </span>
                  </span>
                )}
              </button>
            }
          />
        ) : null}
      </div>
    </nav>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { LogOut, PanelLeftClose, PanelLeftOpen, Settings, ShieldCheck } from "lucide-react";
import { Tiki } from "@/components/tiki/tiki";
import { cx } from "@/components/ui/cx";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useIsAdmin } from "@/features/admin/queries";
import { profileStore, signOut } from "@/lib/auth";
import { railStore, toggleRail } from "@/lib/prefs";
import { useStore } from "@/lib/store";
import { NAV, type NavLink, sectionOf, tourId } from "./nav";

/** The current path inside /app, "/" for Today. */
export function usePath(): string {
  return useRouterState({
    select: (state) => state.location.pathname.replace(/^\/app/, "") || "/",
  });
}

function Item({ link, active, rail }: { link: NavLink; active: boolean; rail: boolean }) {
  const content = (
    <Link
      to={link.to}
      data-tour={tourId(link.to)}
      aria-current={active ? "page" : undefined}
      aria-label={rail ? link.label : undefined}
      className={cx(
        "flex items-center gap-2.5 rounded-xl font-semibold transition-colors duration-150",
        rail ? "size-10 justify-center" : "h-9 px-2.5",
        active
          ? "bg-card text-ink shadow-sm shadow-ink/5"
          : "text-muted hover:bg-line/50 hover:text-ink",
      )}
    >
      <link.icon aria-hidden className="size-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
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
 * The wide-screen sidebar, a step darker than the page: the four places (each one's
 * pages are tabs over the view, see section-tabs.tsx), then Admin, Settings and the
 * account at the foot. Folds to an icon rail on medium screens or when the person
 * chooses.
 */
export function Sidebar({ forceRail }: { forceRail: boolean }) {
  const path = usePath();
  const chosenRail = useStore(railStore);
  const rail = forceRail || chosenRail;
  const section = sectionOf(path);
  const profile = useStore(profileStore);
  const isAdmin = useIsAdmin();

  return (
    <nav
      aria-label="Main"
      className={cx(
        "hidden shrink-0 flex-col border-r border-line bg-chrome py-4 sm:flex",
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

      {/* Only the places scroll; Settings and the account stay at the foot. */}
      <div
        className={cx(
          "-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-1",
          rail && "items-center",
        )}
      >
        {NAV.map((top) => (
          <Item
            key={top.to}
            link={top}
            // Settings and Focus belong to no section; Today is only "/" itself.
            active={top.to === section.to && (top.to !== "/" || path === "/")}
            rail={rail}
          />
        ))}
      </div>

      <div
        className={cx(
          "flex shrink-0 flex-col gap-1 border-t border-line pt-3",
          rail && "items-center",
        )}
      >
        {isAdmin ? (
          <Item
            link={{ to: "/admin", label: "Admin", icon: ShieldCheck }}
            active={path.startsWith("/admin")}
            rail={rail}
          />
        ) : null}
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

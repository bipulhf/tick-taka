import {
  Archive,
  ArrowUpDown,
  BarChart3,
  BookCheck,
  CalendarCheck,
  CalendarDays,
  CalendarFold,
  CalendarRange,
  CircleDashed,
  Clock,
  HandCoins,
  Inbox,
  Landmark,
  ListChecks,
  type LucideIcon,
  Moon,
  PieChart,
  PiggyBank,
  Plane,
  Receipt,
  Repeat2,
  Sun,
  Timer,
  Wallet,
} from "lucide-react";

export interface NavLink {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Keyboard shortcut after G (G T for Today). */
  key?: string;
  /** Detail pages that belong to this view's tab: one routine sits under Routines. */
  owns?: string;
}

export interface NavSection extends NavLink {
  children: NavLink[];
}

/** The four places, as on the phone's tab bar, each with its views (the page tabs). */
export const NAV: NavSection[] = [
  { to: "/", label: "Today", icon: Sun, key: "t", children: [] },
  {
    to: "/plan",
    label: "Plan",
    icon: CalendarDays,
    key: "p",
    children: [
      { to: "/plan", label: "Inbox and upcoming", icon: Inbox, key: "i" },
      { to: "/plan/day", label: "Day", icon: Clock, key: "d" },
      { to: "/plan/week", label: "Week", icon: CalendarRange, key: "w" },
      { to: "/plan/calendar", label: "Calendar", icon: CalendarDays, key: "c" },
      { to: "/plan/someday", label: "Someday", icon: Archive },
      { to: "/plan/logbook", label: "Logbook", icon: BookCheck, key: "l" },
      { to: "/plan/habits", label: "Habits", icon: Repeat2, key: "h" },
      { to: "/plan/routines", label: "Routines", icon: ListChecks, owns: "/plan/routine/" },
      { to: "/plan/time", label: "Time", icon: Timer },
    ],
  },
  {
    to: "/money",
    label: "Money",
    icon: Wallet,
    key: "m",
    children: [
      { to: "/money", label: "Overview", icon: Wallet },
      { to: "/money/transactions", label: "Transactions", icon: ArrowUpDown, key: "x" },
      { to: "/money/budgets", label: "Budgets", icon: PieChart, key: "b" },
      { to: "/money/bills", label: "Bills and income", icon: Receipt },
      { to: "/money/goals", label: "Goals", icon: PiggyBank },
      { to: "/money/debts", label: "Debts", icon: HandCoins },
      { to: "/money/events", label: "Events", icon: Plane },
      { to: "/money/accounts", label: "Accounts", icon: Landmark, key: "a" },
    ],
  },
  {
    to: "/review",
    label: "Review",
    icon: CircleDashed,
    key: "r",
    children: [
      { to: "/review", label: "Overview", icon: CircleDashed },
      { to: "/review/shutdown", label: "Shutdown", icon: Moon, key: "s" },
      { to: "/review/weekly", label: "Weekly", icon: CalendarCheck },
      { to: "/review/monthly", label: "Monthly", icon: CalendarFold },
      { to: "/review/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

/** The section a path belongs to: "/money/budgets" is in Money. */
export function sectionOf(pathname: string): NavSection {
  const path = pathname.replace(/^\/app/, "") || "/";
  return (
    NAV.find((section) => section.to !== "/" && path.startsWith(section.to)) ??
    (NAV[0] as NavSection)
  );
}

/**
 * The section's page tab a path opens: the section's own page only on itself, any
 * other view on itself and below, plus the detail pages it owns. An area or a project
 * belongs to no tab. Pure, so it can be tested.
 */
export function activeTab(pathname: string, section: NavSection): NavLink | undefined {
  const path = pathname.replace(/^\/app/, "") || "/";
  return section.children.find((link) =>
    link.to === section.to
      ? path === link.to
      : path === link.to ||
        path.startsWith(`${link.to}/`) ||
        (link.owns !== undefined && path.startsWith(link.owns)),
  );
}

/** The app tour's name for a place's link, the same in the sidebar and the tab bar. */
export const tourId = (to: string) => `nav-${to.replace(/^\//, "") || "today"}`;
